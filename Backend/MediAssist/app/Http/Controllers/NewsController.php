<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Actualités médicales marocaines, agrégées depuis les sources officielles et
 * la presse spécialisée.
 *
 * Chaque source est isolée dans son propre try/catch : si l'une tombe ou change
 * de gabarit, les autres continuent d'alimenter la page. Le résultat complet
 * est mis en cache pour ne pas solliciter les sites publics à chaque affichage.
 */
class NewsController extends Controller
{
    private const CACHE_KEY = 'medical_news_feed_v2';
    private const CACHE_MINUTES = 30;
    private const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        . '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    /** Nombre max d'articles dont on va chercher l'image sur la page source. */
    private const OG_ENRICH_LIMIT = 14;

    private function sources(): array
    {
        return [
            // ── Officiel / institutionnel ─────────────────────────────────
            'ANAM' => [
                'label' => "ANAM — Agence Nationale de l'Assurance Maladie",
                'kind' => 'Officiel',
                'home' => 'https://anam.ma/anam/',
                'type' => 'rss',
                'url' => 'https://anam.ma/anam/feed/',
            ],
            'CNSS' => [
                'label' => 'CNSS — Caisse Nationale de Sécurité Sociale',
                'kind' => 'Officiel',
                'home' => 'https://www.cnss.ma/fr/actualites',
                'type' => 'cnss',
                'url' => 'https://www.cnss.ma/fr/actualites',
            ],
            'SANTE_GOV' => [
                'label' => 'Ministère de la Santé — appels & activités',
                'kind' => 'Officiel',
                'home' => 'https://www.sante.gov.ma/Pages/activites.aspx',
                'type' => 'sante_gov',
                'url' => 'https://www.sante.gov.ma/Pages/activites.aspx',
            ],
            'OMS' => [
                'label' => 'OMS — Bureau Maroc (EMRO)',
                'kind' => 'Officiel',
                'home' => 'https://www.emro.who.int/fr/mor/morocco-news/',
                'type' => 'emro',
                'url' => 'https://www.emro.who.int/fr/mor/morocco-news/',
            ],

            // ── Presse spécialisée & générale ─────────────────────────────
            'MEDICAMENT' => [
                'label' => 'Medicament.ma — actualité du médicament',
                'kind' => 'Spécialisé',
                'home' => 'https://medicament.ma/news/',
                'type' => 'rss',
                'url' => 'https://medicament.ma/feed/',
            ],
            'MEDIAS24' => [
                'label' => 'Médias24 — rubrique Santé',
                'kind' => 'Presse',
                'home' => 'https://medias24.com/categorie/sante/',
                'type' => 'rss',
                'url' => 'https://medias24.com/categorie/sante/feed/',
            ],
            'HESPRESS' => [
                'label' => 'Hespress English — Healthcare in Morocco',
                'kind' => 'Presse',
                'home' => 'https://en.hespress.com/tag/healthcare-in-morocco',
                'type' => 'rss',
                'url' => 'https://en.hespress.com/tag/healthcare-in-morocco/feed',
            ],
            'MWN' => [
                'label' => 'Morocco World News — Health',
                'kind' => 'Presse',
                'home' => 'https://www.moroccoworldnews.com/health/',
                // Le flux RSS renvoie 403 (protection anti-bot) ; la page HTML
                // répond normalement avec un User-Agent de navigateur.
                'type' => 'mwn',
                'url' => 'https://www.moroccoworldnews.com/health/',
            ],
            'JSM' => [
                'label' => 'Journal Santé Maroc',
                'kind' => 'Spécialisé',
                'home' => 'https://journalsantemaroc.com/infos-sante.html',
                'type' => 'jsm',
                'url' => 'https://journalsantemaroc.com/infos-sante.html',
            ],
        ];
    }

    public function index(Request $request)
    {
        if ($request->boolean('refresh')) {
            Cache::forget(self::CACHE_KEY);
        }

        $payload = Cache::remember(self::CACHE_KEY, now()->addMinutes(self::CACHE_MINUTES), function () {
            $items = [];
            $status = [];

            foreach ($this->sources() as $code => $src) {
                try {
                    $fetched = match ($src['type']) {
                        'rss' => $this->fetchRss($code, $src),
                        'cnss' => $this->fetchCnss($code, $src),
                        'sante_gov' => $this->fetchSanteGov($code, $src),
                        'emro' => $this->fetchEmro($code, $src),
                        'mwn' => $this->fetchMwn($code, $src),
                        'jsm' => $this->fetchJsm($code, $src),
                        default => [],
                    };
                    $items = array_merge($items, $fetched);
                    $status[$code] = [
                        'ok' => true, 'count' => count($fetched),
                        'label' => $src['label'], 'kind' => $src['kind'], 'home' => $src['home'],
                    ];
                } catch (\Throwable $e) {
                    Log::warning("news source {$code} failed: " . $e->getMessage());
                    $status[$code] = [
                        'ok' => false, 'count' => 0,
                        'label' => $src['label'], 'kind' => $src['kind'], 'home' => $src['home'],
                    ];
                }
            }

            usort($items, fn ($a, $b) => strcmp($b['published_at'] ?? '', $a['published_at'] ?? ''));
            $items = array_slice($items, 0, 140);
            $items = $this->enrichImages($items);

            return [
                'items' => $items,
                'sources' => $status,
                'fetched_at' => now()->toIso8601String(),
            ];
        });

        return response()->json(['success' => true] + $payload);
    }

    // ── HTTP ────────────────────────────────────────────────────────────

    private function get(string $url, int $timeout = 25): string
    {
        return Http::withHeaders([
            'User-Agent' => self::UA,
            'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language' => 'fr-FR,fr;q=0.9,en;q=0.8',
        ])->timeout($timeout)->withoutVerifying()->get($url)->throw()->body();
    }

    // ── Parseurs ────────────────────────────────────────────────────────

    /** Flux RSS/Atom WordPress (ANAM, medicament.ma, Médias24, Hespress). */
    private function fetchRss(string $code, array $src): array
    {
        $body = $this->get($src['url'], 20);

        $prev = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($body);
        libxml_use_internal_errors($prev);
        if (!$xml || !isset($xml->channel->item)) {
            return [];
        }

        $out = [];
        foreach ($xml->channel->item as $item) {
            $media = $item->children('media', true);
            $content = (string) ($item->children('content', true)->encoded ?? '');
            $desc = (string) $item->description;

            $image = null;
            if (isset($media->content) && (string) $media->content->attributes()->url) {
                $image = (string) $media->content->attributes()->url;
            } elseif (isset($media->thumbnail) && (string) $media->thumbnail->attributes()->url) {
                $image = (string) $media->thumbnail->attributes()->url;
            } elseif (isset($item->enclosure) && str_starts_with((string) $item->enclosure->attributes()->type, 'image/')) {
                $image = (string) $item->enclosure->attributes()->url;
            } else {
                $image = $this->firstImage($content) ?? $this->firstImage($desc);
            }

            $out[] = $this->item($code, $src, [
                'title' => (string) $item->title,
                'url' => trim((string) $item->link),
                'summary' => strip_tags($desc),
                'published_at' => $this->date((string) $item->pubDate),
                'category' => trim((string) ($item->category[0] ?? '')) ?: null,
                'image' => $image,
            ]);
        }
        return $out;
    }

    /**
     * Actualités CNSS. Page rendue par Next.js, sans URL propre par article :
     * on garde date, catégorie et titre, et on renvoie vers l'index.
     */
    private function fetchCnss(string $code, array $src): array
    {
        $text = $this->flatten($this->get($src['url']));
        $re = '/(\d{1,2}\/\d{1,2}\/\d{4})\s*\|+\s*\|*\s*(Actualités|Événements|Communiqués)\s*\|+\s*([^|]{12,220}?)\s*\|+\s*Lire la suite/u';
        if (!preg_match_all($re, $text, $m, PREG_SET_ORDER)) {
            return [];
        }

        $out = $seen = [];
        foreach ($m as $row) {
            $title = $this->clean($row[3]);
            if ($title === '' || isset($seen[$title])) {
                continue;
            }
            $seen[$title] = true;
            $out[] = $this->item($code, $src, [
                'title' => $title,
                'url' => $src['url'],
                'published_at' => $this->date($row[1], 'm/d/Y'),
                'category' => $row[2],
            ]);
        }
        return $out;
    }

    /** Ministère de la Santé : appels à candidature et activités (SharePoint). */
    private function fetchSanteGov(string $code, array $src): array
    {
        $html = $this->get($src['url'], 35);
        $re = '/<span>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/span>\s*-?\s*<a[^>]*href="([^"]+)"[^>]*title="([^"]{10,200})"/s';
        if (!preg_match_all($re, $html, $m, PREG_SET_ORDER)) {
            return [];
        }

        $out = $seen = [];
        foreach ($m as $row) {
            // Les titres SharePoint sont tronqués par « .. » : on le retire.
            $title = $this->clean(preg_replace('/\s*\.\.\s*$/u', '…', html_entity_decode($row[3], ENT_QUOTES, 'UTF-8')));
            if ($title === '' || isset($seen[$title])) {
                continue;
            }
            $seen[$title] = true;
            $out[] = $this->item($code, $src, [
                'title' => $title,
                'url' => $this->absolute($row[2], 'https://www.sante.gov.ma'),
                'published_at' => $this->date($row[1], 'd/m/Y'),
                'category' => 'Appel à candidature',
            ]);
            if (count($out) >= 20) {
                break;
            }
        }
        return $out;
    }

    /** OMS — bureau régional EMRO, fil Maroc. */
    private function fetchEmro(string $code, array $src): array
    {
        $html = $this->get($src['url'], 30);
        $re = '/<a\s+href="(\/fr\/mor\/morocco-news\/[a-z0-9\-]+\.html)"[^>]*>\s*([^<]{15,200}?)\s*<\/a>/is';
        if (!preg_match_all($re, $html, $m, PREG_SET_ORDER)) {
            return [];
        }

        $out = $seen = [];
        foreach ($m as $row) {
            $title = $this->clean(html_entity_decode($row[2], ENT_QUOTES, 'UTF-8'));
            if ($title === '' || isset($seen[$title]) || mb_strlen($title) < 20) {
                continue;
            }
            $seen[$title] = true;
            $out[] = $this->item($code, $src, [
                'title' => $title,
                'url' => $this->absolute($row[1], 'https://www.emro.who.int'),
                'category' => 'OMS Maroc',
            ]);
            if (count($out) >= 15) {
                break;
            }
        }
        return $out;
    }

    /** Morocco World News — rubrique Health (thème WordPress JNews). */
    private function fetchMwn(string $code, array $src): array
    {
        $html = $this->get($src['url'], 35);
        $re = '/<h3 class="jeg_post_title">\s*<a\s+href="([^"]+)"[^>]*>\s*([^<]{12,220}?)\s*<\/a>/is';
        if (!preg_match_all($re, $html, $m, PREG_SET_ORDER)) {
            return [];
        }

        // Les vignettes sont en lazy-load : la vraie URL est dans data-src, dans
        // l'ordre d'apparition des articles.
        preg_match_all('/data-src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i', $html, $imgs);
        $thumbs = $imgs[1] ?? [];

        $out = $seen = [];
        foreach ($m as $i => $row) {
            $title = $this->clean(html_entity_decode($row[2], ENT_QUOTES, 'UTF-8'));
            if ($title === '' || isset($seen[$title])) {
                continue;
            }
            $seen[$title] = true;
            // La date figure dans l'URL : /2026/08/335870/slug/
            $published = preg_match('#/(\d{4})/(\d{2})/#', $row[1], $d)
                ? $this->date("{$d[1]}-{$d[2]}-01")
                : null;
            $out[] = $this->item($code, $src, [
                'title' => $title,
                'url' => $row[1],
                'published_at' => $published,
                'category' => 'Health',
                'image' => $thumbs[$i] ?? null,
            ]);
        }
        return $out;
    }

    /** Journal Santé Maroc — rubrique « Infos santé ». */
    private function fetchJsm(string $code, array $src): array
    {
        $html = $this->get($src['url'], 30);
        $re = '/<h3[^>]*>\s*<a\s+href="(\/news-sante\/[^"]+)"[^>]*>\s*([^<]{12,220}?)\s*<\/a>/is';
        if (!preg_match_all($re, $html, $m, PREG_SET_ORDER)) {
            return [];
        }

        preg_match_all('/data-src="(https:\/\/journalsantemaroc\.com\/+images\/[^"]+)"/i', $html, $imgs);
        $thumbs = array_values(array_filter($imgs[1] ?? [], fn ($u) => !str_contains($u, 'logo')));

        $out = $seen = [];
        foreach ($m as $i => $row) {
            $title = $this->clean(html_entity_decode($row[2], ENT_QUOTES, 'UTF-8'));
            if ($title === '' || isset($seen[$title])) {
                continue;
            }
            $seen[$title] = true;
            $out[] = $this->item($code, $src, [
                'title' => $title,
                'url' => $this->absolute($row[1], 'https://journalsantemaroc.com'),
                'category' => 'Infos santé',
                'image' => isset($thumbs[$i]) ? preg_replace('#(?<!:)//+#', '/', $thumbs[$i]) : null,
            ]);
        }
        return $out;
    }

    // ── Images ──────────────────────────────────────────────────────────

    /**
     * Complète les articles sans visuel en lisant la balise og:image de leur
     * page. Limité et borné en temps : une page d'actualités ne doit jamais
     * attendre après des sites tiers.
     */
    private function enrichImages(array $items): array
    {
        $budget = self::OG_ENRICH_LIMIT;
        foreach ($items as $i => $item) {
            if ($budget <= 0) {
                break;
            }
            if (!empty($item['image']) || empty($item['url'])) {
                continue;
            }
            $budget--;
            try {
                $html = $this->get($item['url'], 8);
                if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)/i', $html, $m)
                    || preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']/i', $html, $m)) {
                    $items[$i]['image'] = $m[1];
                }
            } catch (\Throwable $e) {
                // Une vignette manquante n'est pas une erreur : on continue.
            }
        }
        return $items;
    }

    // ── Utilitaires ─────────────────────────────────────────────────────

    private function item(string $code, array $src, array $fields): array
    {
        return [
            'source' => $code,
            'source_label' => $src['label'],
            'source_home' => $src['home'],
            'source_kind' => $src['kind'],
            'title' => $this->clean(html_entity_decode($fields['title'] ?? '', ENT_QUOTES, 'UTF-8')),
            'url' => $fields['url'] ?? $src['home'],
            'summary' => isset($fields['summary'])
                ? $this->shorten(html_entity_decode($fields['summary'], ENT_QUOTES, 'UTF-8'), 240)
                : null,
            'published_at' => $fields['published_at'] ?? null,
            'category' => $fields['category'] ?? null,
            'image' => $fields['image'] ?? null,
        ];
    }

    private function flatten(string $html): string
    {
        $t = preg_replace('/<script[^>]*>.*?<\/script>/si', ' ', $html);
        $t = preg_replace('/<[^>]+>/', '|', $t);
        return html_entity_decode($t, ENT_QUOTES, 'UTF-8');
    }

    private function clean(string $s): string
    {
        return trim(preg_replace('/\s+/u', ' ', $s));
    }

    private function shorten(string $s, int $max): string
    {
        $s = $this->clean(strip_tags($s));
        // Les flux WordPress ajoutent « The post … appeared first on … ».
        $s = preg_replace('/\s*The post .*$/su', '', $s);
        return mb_strlen($s) > $max ? mb_substr($s, 0, $max) . '…' : $s;
    }

    private function absolute(string $url, string $base): string
    {
        if (preg_match('#^https?://#i', $url)) {
            return $url;
        }
        return rtrim($base, '/') . '/' . ltrim($url, '/');
    }

    private function date(string $raw, ?string $format = null): ?string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return null;
        }
        try {
            return ($format ? Carbon::createFromFormat($format, $raw)->startOfDay() : Carbon::parse($raw))
                ->toIso8601String();
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function firstImage(string $html): ?string
    {
        if ($html !== '' && preg_match('/<img[^>]+src="([^"]+)"/i', $html, $m)) {
            return $m[1];
        }
        return null;
    }
}
