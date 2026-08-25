<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use JsonMachine\Items;

/**
 * php artisan research:import-pmc-patients {--limit=} {--chunk=1000}
 *
 * Imports the PMC-Patients-V2 dataset (837MB JSON array of ~250k de-identified
 * case reports) into research_cases. The file is streamed with halaxa/json-machine
 * (a pull-parser) rather than json_decode()'d whole, since decoding an 837MB array
 * in one go would multiply well past the ~2-4x in-memory overhead PHP arrays carry
 * over raw JSON text — streaming keeps memory flat regardless of file size.
 *
 * Re-run behaviour: upsert-safe via insertOrIgnore keyed on (source, source_id)
 * (source_id = the dataset's own patient_uid), so re-running this command after
 * a partial/interrupted run just fills in what's missing rather than duplicating.
 */
class ImportPmcPatientsResearchCases extends Command
{
    protected $signature = 'research:import-pmc-patients
                            {--limit= : Max records to import (dev/test runs)}
                            {--chunk=1000 : Rows per bulk insert batch}';

    protected $description = 'Import the PMC-Patients-V2 dataset into research_cases';

    private const LICENSE = 'CC-BY-NC-SA-4.0';

    public function handle(): int
    {
        $path = storage_path('app/research-data/pmc-patients-v2.json');
        if (!is_file($path)) {
            $this->error("PMC-Patients file not found: {$path}");
            return Command::FAILURE;
        }

        // Streaming decode of an 837MB array can still hold references to prior
        // chunks in memory during a long run; give ourselves headroom rather than
        // relying on the container's default 128M.
        ini_set('memory_limit', '2G');

        $limit = $this->option('limit') !== null ? (int) $this->option('limit') : null;
        $chunkSize = max(1, (int) $this->option('chunk'));

        $this->info('Streaming ' . number_format(filesize($path)) . ' bytes from ' . $path);

        $items = Items::fromFile($path, ['decoder' => new \JsonMachine\JsonDecoder\ExtJsonDecoder(true)]);

        $rows = [];
        $processed = 0;
        $inserted = 0;
        $skipped = 0;

        foreach ($items as $record) {
            if ($limit !== null && $processed >= $limit) {
                break;
            }
            $processed++;

            $patientUid = $record['patient_uid'] ?? null;
            $text = $record['patient'] ?? null;
            if (empty($patientUid) || empty($text)) {
                $skipped++;
                continue;
            }

            $pmid = $record['PMID'] ?? null;
            $now = now();

            $rows[] = [
                'source' => 'pmc_patients',
                'source_id' => (string) $patientUid,
                'language' => 'en',
                'title' => $record['title'] ?? null,
                'age' => $this->formatAge($record['age'] ?? null),
                'gender' => $record['gender'] ?? null,
                'summary_text' => $text,
                'entities' => null,
                'license' => self::LICENSE,
                'source_url' => $pmid ? "https://pubmed.ncbi.nlm.nih.gov/{$pmid}/" : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($rows) >= $chunkSize) {
                $inserted += DB::table('research_cases')->insertOrIgnore($rows);
                $rows = [];
                if ($processed % 10000 === 0) {
                    $this->info("  processed {$processed} records, inserted {$inserted} so far...");
                }
            }
        }

        if (!empty($rows)) {
            $inserted += DB::table('research_cases')->insertOrIgnore($rows);
        }

        $this->info("Done. Processed {$processed} records, inserted (or ignored-as-duplicate) {$inserted} rows, skipped {$skipped} incomplete records.");
        return Command::SUCCESS;
    }

    /**
     * PMC-Patients ages are messy [[value, unit], ...] tuples (usually one
     * tuple, occasionally several for a case spanning a range). Store as a
     * simple readable text string, e.g. "34 year" or "5 month, 34 year".
     */
    private function formatAge(?array $age): ?string
    {
        if (empty($age)) {
            return null;
        }
        $parts = [];
        foreach ($age as $tuple) {
            if (is_array($tuple) && count($tuple) === 2) {
                [$value, $unit] = $tuple;
                $value = is_float($value) && floor($value) == $value ? (int) $value : $value;
                $parts[] = "{$value} {$unit}";
            }
        }
        return empty($parts) ? null : implode(', ', $parts);
    }
}
