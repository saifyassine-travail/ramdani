<?php

namespace App\Http\Controllers;

use App\Models\Medicament;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Reads the national reference base (PostgreSQL schema `med_ref`) that pairs
 * the medicament.ma catalogue with the CNSS and CNOPS reimbursement lists.
 *
 * The schema is loaded separately by scripts/med-scraper/load_postgres.sh, so
 * every endpoint degrades to an empty-but-successful answer when it is absent:
 * the practice must keep working on an install where the base was never loaded.
 */
class MedicamentReferenceController extends Controller
{
    private const SCHEMA = 'med_ref';

    private function available(): bool
    {
        try {
            return DB::selectOne(
                "SELECT 1 AS ok FROM information_schema.tables
                 WHERE table_schema = ? AND table_name = 'remboursement'",
                [self::SCHEMA]
            ) !== null;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function unavailable(string $key)
    {
        return response()->json([
            'success' => true,
            'available' => false,
            $key => [],
            'message' => "Base de référence non installée (schéma med_ref).",
        ]);
    }

    /**
     * GET /api/medicaments/reference/search?q=...
     * Type-ahead over the national base, for importing a product into the
     * practice catalogue.
     */
    public function search(Request $request)
    {
        if (!$this->available()) {
            return $this->unavailable('results');
        }
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['success' => true, 'available' => true, 'results' => []]);
        }

        $rows = DB::select(
            "SELECT m.id, m.name, m.brand, m.form, m.dosage, m.presentation, m.ppv,
                    m.prix_hospitalier, m.composition, m.atc_code, m.is_princeps,
                    l.name AS laboratoire, tc.name AS classe_therapeutique,
                    EXISTS (SELECT 1 FROM " . self::SCHEMA . ".medicament_remboursement mr
                            JOIN " . self::SCHEMA . ".remboursement r
                              ON r.regime = mr.regime AND r.ean13 = mr.ean13
                            WHERE mr.medicament_id = m.id AND r.remboursable = 1) AS remboursable
             FROM " . self::SCHEMA . ".medicament m
             LEFT JOIN " . self::SCHEMA . ".laboratory l ON l.id = m.laboratory_id
             LEFT JOIN " . self::SCHEMA . ".therapeutic_class tc ON tc.id = m.therapeutic_class_id
             WHERE m.name ILIKE ? OR m.composition ILIKE ?
             ORDER BY m.name
             LIMIT 40",
            ['%' . $q . '%', '%' . $q . '%']
        );

        return response()->json(['success' => true, 'available' => true, 'results' => $rows]);
    }

    /**
     * GET /api/medicaments/reference/coverage?ids=1,2,3
     * Coverage badges for a whole page of the catalogue in one query — one
     * request per rendered page instead of one per row.
     */
    public function coverage(Request $request)
    {
        if (!$this->available()) {
            return $this->unavailable('coverage');
        }
        $ids = array_values(array_filter(array_map(
            'intval',
            explode(',', (string) $request->query('ids', ''))
        )));
        if (!$ids) {
            return response()->json(['success' => true, 'available' => true, 'coverage' => (object) []]);
        }

        $rows = DB::select(
            "SELECT m.\"ID_Medicament\" AS med_id, r.regime, r.remboursable,
                    COALESCE(r.taux, g.taux_ambulatoire) AS taux, r.base_remboursement AS base
             FROM medicaments m
             JOIN " . self::SCHEMA . ".medicament_remboursement mr ON mr.medicament_id = m.ref_id
             JOIN " . self::SCHEMA . ".remboursement r
               ON r.regime = mr.regime AND r.ean13 = mr.ean13
             JOIN " . self::SCHEMA . ".regime g ON g.code = r.regime
             WHERE m.\"ID_Medicament\" = ANY(?) AND mr.match_score >= 90",
            ['{' . implode(',', $ids) . '}']
        );

        $out = [];
        foreach ($rows as $r) {
            $out[$r->med_id][$r->regime] = [
                'remboursable' => (int) $r->remboursable === 1,
                'taux' => $r->taux === null ? null : (float) $r->taux,
                'base' => $r->base === null ? null : (float) $r->base,
            ];
        }

        return response()->json([
            'success' => true, 'available' => true,
            'coverage' => (object) $out,
        ]);
    }

    /** Resolve the reference id for a practice medicament, by link or by name. */
    private function refIdFor(Medicament $med): ?int
    {
        if ($med->ref_id) {
            return (int) $med->ref_id;
        }
        // Fall back on name + dosage so products added before the base was
        // loaded still resolve, without writing a guess into ref_id.
        $row = DB::selectOne(
            "SELECT id FROM " . self::SCHEMA . ".medicament
             WHERE upper(brand) = upper(?) AND (? = '' OR upper(COALESCE(dosage,'')) = upper(?))
             ORDER BY (ppv IS NULL), id LIMIT 1",
            [(string) ($med->brand ?: $med->name), (string) $med->dosage, (string) $med->dosage]
        );
        return $row ? (int) $row->id : null;
    }

    /**
     * GET /api/medicaments/{id}/remboursement
     * What CNSS and CNOPS reimburse on this product: base, rate, amount and
     * what the patient still pays — plus the same figures under an ALD.
     */
    public function remboursement($id)
    {
        if (!$this->available()) {
            return $this->unavailable('regimes');
        }
        try {
            $med = Medicament::findOrFail($id);
            $refId = $this->refIdFor($med);
            if (!$refId) {
                return response()->json([
                    'success' => true, 'available' => true, 'matched' => false, 'regimes' => [],
                ]);
            }

            $rows = DB::select(
                "SELECT r.regime, r.ean13, r.nom, r.dci, r.presentation, r.categorie,
                        r.remboursable, r.ppv, r.base_remboursement AS base,
                        COALESCE(r.taux, g.taux_ambulatoire) AS taux,
                        ROUND(r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2) AS montant_rembourse,
                        GREATEST(ROUND(r.ppv - r.base_remboursement * COALESCE(r.taux, g.taux_ambulatoire) / 100.0, 2), 0) AS reste_a_charge,
                        ROUND(r.base_remboursement * g.taux_ald / 100.0, 2) AS montant_rembourse_ald,
                        GREATEST(ROUND(r.ppv - r.base_remboursement * g.taux_ald / 100.0, 2), 0) AS reste_a_charge_ald,
                        g.taux_ald, r.code_groupe, mr.match_score, mr.match_method
                 FROM " . self::SCHEMA . ".medicament_remboursement mr
                 JOIN " . self::SCHEMA . ".remboursement r
                   ON r.regime = mr.regime AND r.ean13 = mr.ean13
                 JOIN " . self::SCHEMA . ".regime g ON g.code = r.regime
                 WHERE mr.medicament_id = ? AND mr.match_score >= 90
                 ORDER BY r.regime",
                [$refId]
            );

            return response()->json([
                'success' => true, 'available' => true,
                'matched' => count($rows) > 0,
                'ref_id' => $refId,
                'regimes' => $rows,
            ]);
        } catch (\Throwable $e) {
            Log::error('remboursement error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Erreur lors du calcul du remboursement'], 500);
        }
    }

    /**
     * GET /api/medicaments/{id}/equivalents
     * Three levels, most authoritative first:
     *   officiels  — same CNOPS substitution group (opposable)
     *   substituables — same DCI + dosage + form, from the catalogue
     *   meme_dci   — same active ingredient, any dosage or form
     */
    public function equivalents($id)
    {
        if (!$this->available()) {
            return $this->unavailable('officiels');
        }
        try {
            $med = Medicament::findOrFail($id);
            $refId = $this->refIdFor($med);
            if (!$refId) {
                return response()->json([
                    'success' => true, 'available' => true, 'matched' => false,
                    'officiels' => [], 'substituables' => [], 'meme_dci' => [],
                ]);
            }

            $officiels = DB::select(
                "SELECT e.equivalent_ean13 AS ean13, e.equivalent AS nom,
                        e.equivalent_dosage AS dosage, e.equivalent_forme AS forme,
                        e.equivalent_type AS type, e.equivalent_ppv AS ppv,
                        e.equivalent_base AS base, e.economie, e.economie_pct, e.code_groupe
                 FROM " . self::SCHEMA . ".medicament_remboursement mr
                 JOIN " . self::SCHEMA . ".v_equivalents_officiels e ON e.ean13 = mr.ean13
                 WHERE mr.medicament_id = ? AND mr.regime = 'CNOPS'
                 ORDER BY e.economie_pct DESC NULLS LAST
                 LIMIT 40",
                [$refId]
            );

            $substituables = DB::select(
                "SELECT b.id, b.name AS nom, b.form AS forme, b.dosage, b.presentation,
                        b.pack_size, b.ppv, b.ppv_unitaire, b.unite_conditionnement,
                        b.is_princeps, l.name AS laboratoire,
                        CASE WHEN a.ppv_unitaire > 0 AND b.unite_conditionnement = a.unite_conditionnement
                             THEN ROUND(100.0 * (a.ppv_unitaire - b.ppv_unitaire) / a.ppv_unitaire, 1) END AS economie_pct
                 FROM " . self::SCHEMA . ".medicament a
                 JOIN " . self::SCHEMA . ".medicament b
                   ON b.equiv_key = a.equiv_key AND b.id <> a.id
                 LEFT JOIN " . self::SCHEMA . ".laboratory l ON l.id = b.laboratory_id
                 WHERE a.id = ? AND a.equiv_key <> ''
                 ORDER BY b.ppv_unitaire NULLS LAST, b.ppv NULLS LAST
                 LIMIT 40",
                [$refId]
            );

            $memeDci = DB::select(
                "SELECT b.id, b.name AS nom, b.form AS forme, b.dosage, b.ppv,
                        b.is_princeps, l.name AS laboratoire
                 FROM " . self::SCHEMA . ".medicament a
                 JOIN " . self::SCHEMA . ".medicament b
                   ON b.dci_key = a.dci_key AND b.id <> a.id
                 LEFT JOIN " . self::SCHEMA . ".laboratory l ON l.id = b.laboratory_id
                 WHERE a.id = ? AND a.dci_key <> ''
                 ORDER BY b.name
                 LIMIT 60",
                [$refId]
            );

            return response()->json([
                'success' => true, 'available' => true, 'matched' => true, 'ref_id' => $refId,
                'officiels' => $officiels,
                'substituables' => $substituables,
                'meme_dci' => $memeDci,
            ]);
        } catch (\Throwable $e) {
            Log::error('equivalents error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Erreur lors de la recherche des équivalents'], 500);
        }
    }

    /**
     * POST /api/medicaments/reference/import  { ref_ids: [] }
     * Copies products from the national base into the practice catalogue.
     * Re-importing an already linked product refreshes its prices instead of
     * creating a duplicate.
     */
    public function import(Request $request)
    {
        if (!$this->available()) {
            return response()->json(['success' => false, 'message' => 'Base de référence non installée'], 400);
        }
        $validated = $request->validate([
            'ref_ids' => 'required|array|min:1|max:500',
            'ref_ids.*' => 'integer',
        ]);

        $rows = DB::select(
            "SELECT m.id, m.name, m.brand, m.dosage, m.composition, m.form, m.presentation,
                    m.ppv, m.prix_hospitalier, m.atc_code, m.statut,
                    l.name AS laboratoire, tc.name AS classe
             FROM " . self::SCHEMA . ".medicament m
             LEFT JOIN " . self::SCHEMA . ".laboratory l ON l.id = m.laboratory_id
             LEFT JOIN " . self::SCHEMA . ".therapeutic_class tc ON tc.id = m.therapeutic_class_id
             WHERE m.id = ANY(?)",
            ['{' . implode(',', array_map('intval', $validated['ref_ids'])) . '}']
        );

        $created = $updated = 0;
        foreach ($rows as $r) {
            $med = Medicament::where('ref_id', $r->id)->first();
            $payload = [
                'ref_id' => $r->id,
                'name' => $r->name,
                'brand' => $r->brand,
                'dosage' => $r->dosage,
                'composition' => $r->composition,
                'price' => $r->ppv ?? 0,
                'prix_hospitalier' => $r->prix_hospitalier,
                'Classe_thérapeutique' => $r->classe,
                'Code_ATCv' => $r->atc_code,
                'laboratory' => $r->laboratoire,
                'type' => $r->form,
                'statut' => $r->statut,
                'archived' => false,
            ];
            if ($med) {
                $med->update($payload);
                $updated++;
            } else {
                Medicament::create($payload);
                $created++;
            }
        }

        return response()->json([
            'success' => true,
            'created' => $created,
            'updated' => $updated,
            'message' => "{$created} ajouté(s), {$updated} mis à jour",
        ]);
    }
}
