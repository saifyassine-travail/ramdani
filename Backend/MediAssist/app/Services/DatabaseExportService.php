<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PDO;
use ZipArchive;

/**
 * Builds a downloadable, single-file snapshot of the whole database so the user
 * can keep a local copy. Two formats are supported:
 *   - "db"  : a self-contained SQLite database (every table + rows).
 *   - "csv" : a ZIP archive with one CSV file per table.
 *
 * The returned value is always an absolute path to a temp file; the caller is
 * responsible for streaming it and deleting it afterwards.
 */
class DatabaseExportService
{
    /**
     * Framework / runtime tables that hold no medical data and are never part of
     * a user-facing backup.
     */
    private const EXCLUDED_TABLES = [
        'migrations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
        'password_reset_tokens',
        'personal_access_tokens',
    ];

    /** @var string[]|null */
    private ?array $tableCache = null;

    /**
     * Export every table to a single SQLite database file. Returns the temp path.
     */
    public function exportSqlite(): string
    {
        $path = $this->tempPath('db');
        @unlink($path); // start from a clean file

        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA journal_mode = MEMORY');
        $pdo->beginTransaction();

        try {
            foreach ($this->tables() as $table) {
                $columns = Schema::getColumnListing($table);
                if (empty($columns)) {
                    continue;
                }

                // No column types: SQLite keeps each value's original storage
                // class, so a faithful copy of the source data is preserved.
                $cols = array_map(fn ($c) => $this->quote($c), $columns);
                $pdo->exec('CREATE TABLE ' . $this->quote($table) . ' (' . implode(', ', $cols) . ')');

                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $insert = $pdo->prepare(
                    'INSERT INTO ' . $this->quote($table) . ' (' . implode(', ', $cols) . ') VALUES (' . $placeholders . ')'
                );

                foreach (DB::table($table)->cursor() as $row) {
                    $insert->execute($this->rowValues((array) $row, $columns));
                }
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            $pdo = null;
            @unlink($path);
            throw $e;
        }

        $pdo = null;
        return $path;
    }

    /**
     * Export every table to a ZIP archive containing one CSV per table. Returns
     * the temp path.
     */
    public function exportCsvZip(): string
    {
        $path = $this->tempPath('zip');
        @unlink($path);

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new Exception('Could not create the ZIP archive.');
        }

        foreach ($this->tables() as $table) {
            $zip->addFromString($table . '.csv', $this->tableToCsv($table));
        }

        $zip->close();
        return $path;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Serialise one table to a UTF-8 CSV string (Excel-friendly, with BOM). */
    private function tableToCsv(string $table): string
    {
        $columns = Schema::getColumnListing($table);
        $stream  = fopen('php://temp', 'r+');

        fwrite($stream, "\xEF\xBB\xBF"); // BOM so Excel reads UTF-8 correctly
        fputcsv($stream, $columns, ',', '"', '\\');

        foreach (DB::table($table)->cursor() as $row) {
            fputcsv($stream, $this->rowValues((array) $row, $columns), ',', '"', '\\');
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return $csv;
    }

    /** Project a DB row onto the column list, flattening arrays/objects/bools. */
    private function rowValues(array $row, array $columns): array
    {
        $values = [];
        foreach ($columns as $col) {
            $value = $row[$col] ?? null;
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE);
            } elseif (is_bool($value)) {
                $value = $value ? 1 : 0;
            }
            $values[] = $value;
        }
        return $values;
    }

    /** All exportable table names (domain tables only), memoised. */
    private function tables(): array
    {
        if ($this->tableCache !== null) {
            return $this->tableCache;
        }

        return $this->tableCache = collect(Schema::getTableListing())
            // Some drivers qualify names as "schema.table" — keep the table part.
            ->map(fn ($t) => str_contains($t, '.') ? Str::afterLast($t, '.') : $t)
            ->reject(fn ($t) => in_array($t, self::EXCLUDED_TABLES, true))
            ->unique()
            ->values()
            ->all();
    }

    private function tempPath(string $ext): string
    {
        return sys_get_temp_dir()
            . DIRECTORY_SEPARATOR
            . 'mediassist_export_' . now()->format('Ymd_His') . '_' . Str::random(6) . '.' . $ext;
    }

    private function quote(string $identifier): string
    {
        return '"' . str_replace('"', '""', $identifier) . '"';
    }
}
