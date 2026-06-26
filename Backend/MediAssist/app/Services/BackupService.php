<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\BackupLog;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackupService
{
    public function __construct(
        private readonly EncryptionService $encryption,
        private readonly GoogleDriveService $drive,
    ) {}

    /**
     * Collect all user-linked medical data, encrypt it, and upload to Google Drive.
     */
    public function createBackup(User $user, string $password): array
    {
        if (!$user->google_access_token) {
            throw new Exception('Google account not linked. Please connect your Google account first.');
        }

        // 1. Collect all data belonging to this user (doctor)
        $data = $this->collectUserData($user);

        // 2. JSON-encode
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        // 3. Encrypt
        $encrypted = $this->encryption->encrypt($json, $password);

        // 4. Write to temp file
        $date     = now()->format('Y-m-d_His');
        $fileName = "mediassist_backup_{$user->id}_{$date}.enc";
        $tempPath = sys_get_temp_dir() . '/' . $fileName;
        file_put_contents($tempPath, $encrypted);

        $fileSize = filesize($tempPath);

        // 5. Upload to Drive
        $log = BackupLog::create([
            'user_id'         => $user->id,
            'drive_file_name' => $fileName,
            'backup_size'     => $fileSize,
            'status'          => 'pending',
        ]);

        try {
            $driveFileId = $this->drive->uploadFile($user, $tempPath, $fileName);

            $log->update([
                'drive_file_id' => $driveFileId,
                'status'        => 'success',
            ]);

            @unlink($tempPath);

            AppNotification::record(
                'backup',
                'Sauvegarde réussie',
                'Sauvegarde Google Drive (' . $this->humanSize($fileSize) . ') terminée.',
                'success',
                null,
                ['drive_file_id' => $driveFileId],
            );

            return [
                'success'       => true,
                'drive_file_id' => $driveFileId,
                'file_name'     => $fileName,
                'size_bytes'    => $fileSize,
            ];
        } catch (Exception $e) {
            $log->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
            @unlink($tempPath);

            AppNotification::record(
                'backup',
                'Échec de la sauvegarde',
                'La sauvegarde Google Drive a échoué : ' . $e->getMessage(),
                'error',
            );

            throw $e;
        }
    }

    /**
     * Download an encrypted backup from Drive, decrypt, and restore data to DB.
     */
    public function restoreBackup(User $user, string $driveFileId, string $password): array
    {
        // 1. Download encrypted file
        $tempPath = $this->drive->downloadFile($user, $driveFileId);

        try {
            // 2. Decrypt
            $encrypted = file_get_contents($tempPath);
            $json      = $this->encryption->decrypt($encrypted, $password);
            $data      = json_decode($json, true);

            if (!$data) {
                throw new Exception('Failed to parse backup data — file may be corrupted.');
            }

            // 3. Replace the current data with the snapshot, in one transaction.
            $stats = DB::transaction(function () use ($data) {
                return $this->restoreUserData($data);
            });

            // 4. Realign auto-increment sequences with the restored IDs (outside the
            //    transaction: Postgres sequence changes are not rolled back).
            $this->resetSequences();

            @unlink($tempPath);

            return ['success' => true, 'restored' => $stats];
        } catch (Exception $e) {
            @unlink($tempPath);
            throw $e;
        }
    }

    // -------------------------------------------------------------------------
    // PRIVATE HELPERS
    // -------------------------------------------------------------------------

    /**
     * Collect all medical data for this user (doctor).
     */
    private function collectUserData(User $user): array
    {
        // Load patients with all relations
        $patients = \App\Models\Patient::with([
            'Appointment.medicaments',
            'Appointment.analyses',
            'Appointment.caseDescription',
            'certificats',
            'documents',
        ])->get();

        return [
            'backup_version' => '1.0',
            'user_id'        => $user->id,
            'user_email'     => $user->email,
            'exported_at'    => now()->toIso8601String(),
            'patients'       => $patients->toArray(),
        ];
    }

    /**
     * Replace the current data with the backup snapshot: wipe the backed-up
     * tables, then re-insert the backup rows preserving their original IDs.
     * This makes the database match the backup exactly (records added after the
     * backup are removed). Medicament/analysis CATALOGS are global and not part
     * of the backup, so they are left untouched — only the per-appointment pivots
     * are replaced.
     */
    private function restoreUserData(array $data): array
    {
        $patients = $data['patients'] ?? [];

        // Catalog IDs that still exist (skip pivots pointing at deleted catalog rows).
        $validMedIds      = \App\Models\Medicament::pluck('ID_Medicament')->flip();
        $validAnalysisIds = \App\Models\Analysis::pluck('ID_Analyse')->flip();

        // Keep only real table columns, so a backup taken on a slightly different
        // schema still inserts cleanly.
        $columns = [
            'patients'             => Schema::getColumnListing('patients'),
            'appointments'         => Schema::getColumnListing('appointments'),
            'case_descriptions'    => Schema::getColumnListing('case_descriptions'),
            'certificats_medicaux' => Schema::getColumnListing('certificats_medicaux'),
            'patient_documents'    => Schema::getColumnListing('patient_documents'),
        ];
        // Keep valid columns and JSON-encode array values (raw inserts don't apply
        // Eloquent casts, so JSON columns like medical_acts / custom_measures_values
        // must be encoded here or they'd be stored as the literal "Array").
        $only = function (array $row, string $table) use ($columns): array {
            $row = array_intersect_key($row, array_flip($columns[$table]));
            foreach ($row as $key => $value) {
                if (is_array($value)) {
                    $row[$key] = json_encode($value, JSON_UNESCAPED_UNICODE);
                }
            }
            return $row;
        };

        // 1. Wipe current data (children first for FK safety).
        DB::table('appointment_medicament')->delete();
        DB::table('appointment_analyse')->delete();
        DB::table('case_descriptions')->delete();
        DB::table('patient_documents')->delete();
        DB::table('certificats_medicaux')->delete();
        DB::table('appointments')->delete();
        DB::table('patients')->delete();

        $stats = ['patients_restored' => 0, 'appointments_restored' => 0];
        $now   = now();

        // 2. Re-insert from the snapshot, preserving IDs.
        foreach ($patients as $patientData) {
            $appointments = $patientData['appointment'] ?? [];
            $certificates = $patientData['certificats'] ?? [];
            $documents    = $patientData['documents'] ?? [];
            unset($patientData['appointment'], $patientData['certificats'], $patientData['documents']);

            DB::table('patients')->insert($only($patientData, 'patients'));
            $stats['patients_restored']++;

            foreach ($appointments as $apptData) {
                $medicaments = $apptData['medicaments'] ?? [];
                $analyses    = $apptData['analyses'] ?? [];
                $caseDesc    = $apptData['case_description'] ?? null;
                unset($apptData['medicaments'], $apptData['analyses'], $apptData['case_description'], $apptData['patient']);

                DB::table('appointments')->insert($only($apptData, 'appointments'));
                $stats['appointments_restored']++;
                $rv = $apptData['ID_RV'];

                foreach ($medicaments as $med) {
                    $medId = $med['ID_Medicament'] ?? null;
                    if ($medId === null || !$validMedIds->has($medId)) {
                        continue;
                    }
                    $pivot = $med['pivot'] ?? [];
                    DB::table('appointment_medicament')->insert([
                        'ID_RV'         => $rv,
                        'ID_Medicament' => $medId,
                        'dosage'        => $pivot['dosage'] ?? null,
                        'frequence'     => $pivot['frequence'] ?? null,
                        'duree'         => $pivot['duree'] ?? null,
                        'created_at'    => $pivot['created_at'] ?? $now,
                        'updated_at'    => $pivot['updated_at'] ?? $now,
                    ]);
                }

                foreach ($analyses as $an) {
                    $anId = $an['ID_Analyse'] ?? null;
                    if ($anId === null || !$validAnalysisIds->has($anId)) {
                        continue;
                    }
                    $pivot = $an['pivot'] ?? [];
                    DB::table('appointment_analyse')->insert([
                        'ID_RV'      => $rv,
                        'ID_Analyse' => $anId,
                        'created_at' => $pivot['created_at'] ?? $now,
                        'updated_at' => $pivot['updated_at'] ?? $now,
                    ]);
                }

                if ($caseDesc) {
                    DB::table('case_descriptions')->insert($only($caseDesc, 'case_descriptions'));
                }
            }

            foreach ($certificates as $cert) {
                DB::table('certificats_medicaux')->insert($only($cert, 'certificats_medicaux'));
            }

            foreach ($documents as $doc) {
                DB::table('patient_documents')->insert($only($doc, 'patient_documents'));
            }
        }

        return $stats;
    }

    /**
     * Realign Postgres auto-increment sequences with the max restored IDs so the
     * next insert doesn't collide with a restored row.
     */
    private function resetSequences(): void
    {
        $tables = [
            'patients'             => 'ID_patient',
            'appointments'         => 'ID_RV',
            'case_descriptions'    => 'id',
            'certificats_medicaux' => 'ID_CM',
            'patient_documents'    => 'id',
        ];

        foreach ($tables as $table => $column) {
            try {
                DB::statement(
                    "SELECT setval(pg_get_serial_sequence(?, ?), (SELECT COALESCE(MAX(\"$column\"), 0) + 1 FROM \"$table\"), false)",
                    [$table, $column]
                );
            } catch (\Throwable $e) {
                // Non-fatal (sequence may not exist for this column).
            }
        }
    }

    /** Human-friendly byte size, e.g. "3.2 MB". */
    private function humanSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return $bytes . ' B';
    }
}
