<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * php artisan research:import-e3c {--limit=}
 *
 * Imports the E3C Corpus (HLT-FBK) preprocessed BIO-tagged files into
 * research_cases. Source files (already downloaded, see task brief) are
 * expected under storage/app/research-data/e3c/{Language}/{layer1_train,
 * layer1_test,layer2_text}.txt — one token + BIO tag per line, blank line
 * = sentence boundary, tag suffix is "-ety" (entity) throughout every
 * language/layer combination (verified against all 15 source files before
 * writing this importer).
 *
 * There is no document boundary in the source files, only sentence
 * boundaries, so we reconstruct at sentence granularity and then greedily
 * group consecutive sentences into ~500-1000 char snippets (never splitting
 * a sentence) to form readable "case" records, carrying along the tagged
 * entity spans found in each snippet.
 *
 * Re-run behaviour: upsert-safe via insertOrIgnore keyed on (source,
 * source_id), which is deterministic per language/layer/split/index — so
 * re-running this command is a no-op once fully imported.
 */
class ImportE3cResearchCases extends Command
{
    protected $signature = 'research:import-e3c {--limit= : Max snippets to import per language (dev/test runs)}';

    protected $description = 'Import E3C Corpus case snippets into research_cases';

    private const LANGUAGES = [
        'Basque'  => 'eu',
        'English' => 'en',
        'French'  => 'fr',
        'Italian' => 'it',
        'Spanish' => 'es',
    ];

    private const FILES = [
        'layer1' => ['train', 'test'],
        'layer2' => ['text'],
    ];

    private const SNIPPET_MIN = 500;
    private const SNIPPET_MAX = 1000;

    private const LICENSE = 'CC-BY-NC-4.0';
    private const SOURCE_URL = 'https://github.com/hltfbk/E3C-Corpus';

    public function handle(): int
    {
        $limit = $this->option('limit') !== null ? (int) $this->option('limit') : null;
        $baseDir = storage_path('app/research-data/e3c');

        if (!is_dir($baseDir)) {
            $this->error("E3C data directory not found: {$baseDir}");
            return Command::FAILURE;
        }

        $totalInserted = 0;

        foreach (self::LANGUAGES as $langName => $langCode) {
            $perLanguageCount = 0;

            foreach (self::FILES as $layer => $splits) {
                foreach ($splits as $split) {
                    $filename = $layer === 'layer1' ? "layer1_{$split}.txt" : "layer2_{$split}.txt";
                    $path = "{$baseDir}/{$langName}/{$filename}";

                    if (!is_file($path)) {
                        $this->warn("Missing file, skipping: {$path}");
                        continue;
                    }

                    $sentences = $this->parseFileIntoSentences($path);
                    $snippets = $this->groupIntoSnippets($sentences);

                    if ($limit !== null) {
                        $remaining = max(0, $limit - $perLanguageCount);
                        $snippets = array_slice($snippets, 0, $remaining, true);
                    }

                    $rows = [];
                    foreach ($snippets as $index => $snippet) {
                        [$text, $entities] = $this->reconstructSnippet($snippet);
                        if (trim($text) === '') {
                            continue;
                        }

                        $sourceId = "e3c-{$langCode}-{$layer}-{$split}-{$index}";
                        $now = now();

                        $rows[] = [
                            'source' => 'e3c',
                            'source_id' => $sourceId,
                            'language' => $langCode,
                            'title' => null,
                            'age' => null,
                            'gender' => null,
                            'summary_text' => $text,
                            'entities' => json_encode($entities),
                            'license' => self::LICENSE,
                            'source_url' => self::SOURCE_URL,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                        $perLanguageCount++;

                        if (count($rows) >= 500) {
                            $totalInserted += DB::table('research_cases')->insertOrIgnore($rows);
                            $rows = [];
                        }
                    }

                    if (!empty($rows)) {
                        $totalInserted += DB::table('research_cases')->insertOrIgnore($rows);
                    }

                    $this->info("  {$langName} / {$layer}/{$split}: " . count($snippets) . ' snippets processed');

                    if ($limit !== null && $perLanguageCount >= $limit) {
                        break 2;
                    }
                }
            }
        }

        $this->info("Done. Inserted (or ignored-as-duplicate) {$totalInserted} rows total.");
        return Command::SUCCESS;
    }

    /**
     * @return array<int, array<int, array{token: string, tag: string}>> sentences of tokens
     */
    private function parseFileIntoSentences(string $path): array
    {
        $sentences = [];
        $current = [];

        $handle = fopen($path, 'r');
        while (($line = fgets($handle)) !== false) {
            $line = rtrim($line, "\r\n");
            if ($line === '') {
                if (!empty($current)) {
                    $sentences[] = $current;
                    $current = [];
                }
                continue;
            }
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) < 2) {
                continue;
            }
            $tag = array_pop($parts);
            $token = implode(' ', $parts);
            $current[] = ['token' => $token, 'tag' => $tag];
        }
        if (!empty($current)) {
            $sentences[] = $current;
        }
        fclose($handle);

        return $sentences;
    }

    /**
     * Greedily bin-pack consecutive sentences into ~500-1000 char snippets,
     * never splitting a sentence.
     *
     * @param array<int, array<int, array{token: string, tag: string}>> $sentences
     * @return array<int, array<int, array{token: string, tag: string}>> snippets (each a flat token list)
     */
    private function groupIntoSnippets(array $sentences): array
    {
        $snippets = [];
        $buffer = [];
        $bufferLen = 0;

        foreach ($sentences as $sentence) {
            $sentText = $this->detokenize(array_column($sentence, 'token'));
            $sentLen = mb_strlen($sentText);

            if (!empty($buffer) && ($bufferLen + 1 + $sentLen) > self::SNIPPET_MAX) {
                $snippets[] = $buffer;
                $buffer = [];
                $bufferLen = 0;
            }

            $buffer = array_merge($buffer, $sentence);
            $bufferLen += $sentLen + 1;
        }

        if (!empty($buffer)) {
            $snippets[] = $buffer;
        }

        return $snippets;
    }

    /**
     * @param array<int, array{token: string, tag: string}> $snippetTokens
     * @return array{0: string, 1: array<int, array{text: string, tag: string}>}
     */
    private function reconstructSnippet(array $snippetTokens): array
    {
        $text = $this->detokenize(array_column($snippetTokens, 'token'));

        $entities = [];
        $currentSpan = [];
        $currentTag = null;

        foreach ($snippetTokens as $t) {
            if (str_starts_with($t['tag'], 'B-')) {
                if (!empty($currentSpan)) {
                    $entities[] = ['text' => $this->detokenize($currentSpan), 'tag' => $currentTag];
                }
                $currentSpan = [$t['token']];
                $currentTag = substr($t['tag'], 2);
            } elseif (str_starts_with($t['tag'], 'I-') && !empty($currentSpan)) {
                $currentSpan[] = $t['token'];
            } else {
                if (!empty($currentSpan)) {
                    $entities[] = ['text' => $this->detokenize($currentSpan), 'tag' => $currentTag];
                }
                $currentSpan = [];
                $currentTag = null;
            }
        }
        if (!empty($currentSpan)) {
            $entities[] = ['text' => $this->detokenize($currentSpan), 'tag' => $currentTag];
        }

        return [$text, $entities];
    }

    /**
     * Join tokens with spaces and do a light cleanup pass so the text reads
     * naturally (doesn't need to be perfect — see class docblock).
     *
     * @param array<int, string> $tokens
     */
    private function detokenize(array $tokens): string
    {
        $text = implode(' ', $tokens);
        $text = preg_replace('/\s+/', ' ', $text);
        $text = str_replace([' .', ' ,', ' ;', ' :', " '", "' "], ['.', ',', ';', ':', "'", "'"], $text);
        $text = preg_replace('/\s*-\s*/', '-', $text);
        return trim($text);
    }
}
