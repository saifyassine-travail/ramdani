<?php

namespace App\Services;

use App\Models\BackupLog;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;

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

            return [
                'success'       => true,
                'drive_file_id' => $driveFileId,
                'file_name'     => $fileName,
                'size_bytes'    => $fileSize,
            ];
        } catch (Exception $e) {
            $log->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
            @unlink($tempPath);
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

            // 3. Restore in a single transaction (conflict: last-write-wins via updated_at)
            $stats = DB::transaction(function () use ($user, $data) {
                return $this->restoreUserData($user, $data);
            });

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
     * Re-insert or update data from backup using updated_at for conflict resolution.
     */
    private function restoreUserData(User $user, array $data): array
    {
        $stats = [
            'patients_restored'     => 0,
            'appointments_restored' => 0,
            'skipped'               => 0,
        ];

        foreach ($data['patients'] ?? [] as $patientData) {
            $appointments = $patientData['appointment'] ?? [];
            $certificates = $patientData['certificats'] ?? [];
            unset($patientData['appointment'], $patientData['certificats'], $patientData['documents']);

            // Find or create patient by ID
            $existing = \App\Models\Patient::find($patientData['ID_patient']);

            if ($existing) {
                // Last-write-wins: only overwrite if backup is newer
                $backupUpdatedAt = $patientData['updated_at'] ?? null;
                if ($backupUpdatedAt && $existing->updated_at < $backupUpdatedAt) {
                    $existing->update(array_intersect_key($patientData, array_flip($existing->getFillable())));
                } else {
                    $stats['skipped']++;
                    continue;
                }
                $patient = $existing;
            } else {
                $patient = \App\Models\Patient::create(
                    array_intersect_key($patientData, array_flip((new \App\Models\Patient())->getFillable()))
                );
            }

            $stats['patients_restored']++;

            // Restore appointments
            foreach ($appointments as $apptData) {
                $medicaments  = $apptData['medicaments'] ?? [];
                $analyses     = $apptData['analyses'] ?? [];
                $caseDesc     = $apptData['case_description'] ?? null;
                unset($apptData['medicaments'], $apptData['analyses'], $apptData['case_description'], $apptData['patient']);

                $apptData['ID_patient'] = $patient->ID_patient;
                $existingAppt = \App\Models\Appointment::find($apptData['ID_RV']);

                if ($existingAppt) {
                    if (($apptData['updated_at'] ?? null) && $existingAppt->updated_at < $apptData['updated_at']) {
                        $existingAppt->update(array_intersect_key($apptData, array_flip($existingAppt->getFillable())));
                        $appt = $existingAppt;
                    } else {
                        continue;
                    }
                } else {
                    $appt = \App\Models\Appointment::create(
                        array_intersect_key($apptData, array_flip((new \App\Models\Appointment())->getFillable()))
                    );
                }

                $stats['appointments_restored']++;

                // Restore medicament pivot
                if ($medicaments) {
                    $pivotData = [];
                    foreach ($medicaments as $med) {
                        $pivotData[$med['ID_Medicament']] = [
                            'dosage'   => $med['pivot']['dosage'] ?? null,
                            'frequence'=> $med['pivot']['frequence'] ?? null,
                            'duree'    => $med['pivot']['duree'] ?? null,
                        ];
                    }
                    $appt->medicaments()->syncWithoutDetaching($pivotData);
                }

                // Restore analysis pivot
                if ($analyses) {
                    $appt->analyses()->syncWithoutDetaching(
                        array_column($analyses, 'ID_Analyse')
                    );
                }

                // Restore case description
                if ($caseDesc) {
                    \App\Models\CaseDescription::updateOrCreate(
                        ['ID_RV' => $appt->ID_RV],
                        array_intersect_key($caseDesc, array_flip((new \App\Models\CaseDescription())->getFillable()))
                    );
                }
            }

            // Restore certificates
            foreach ($certificates as $cert) {
                unset($cert['id']);
                $cert['ID_patient'] = $patient->ID_patient;
                \App\Models\Certificate::firstOrCreate(
                    ['ID_patient' => $patient->ID_patient, 'created_at' => $cert['created_at']],
                    array_intersect_key($cert, array_flip((new \App\Models\Certificate())->getFillable()))
                );
            }
        }

        return $stats;
    }
}
