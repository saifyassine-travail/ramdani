<?php

namespace App\Http\Controllers;

use App\Models\ResearchCase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Reference-library lookup for de-identified clinical case reports
 * (PMC-Patients, E3C Corpus). Read-only, no relation to Patient/Appointment.
 */
class ResearchCaseController extends Controller
{
    // GET /api/research-cases?term=&language=&source=&page=
    public function index(Request $request)
    {
        $query = ResearchCase::query();

        $term = trim((string) $request->query('term', ''));
        if ($term !== '') {
            // Uses the generated tsvector column (research_cases.searchable) + its
            // GIN index for real search performance at 250k+ rows.
            $query->whereRaw(
                "searchable @@ plainto_tsquery('simple', ?)",
                [$term]
            )->orderByRaw(
                "ts_rank(searchable, plainto_tsquery('simple', ?)) DESC",
                [$term]
            );
        } else {
            $query->orderBy('id');
        }

        if ($language = $request->query('language')) {
            $query->where('language', $language);
        }

        if ($source = $request->query('source')) {
            $query->where('source', $source);
        }

        $cases = $query->paginate(20)->withQueryString();

        return response()->json($cases);
    }

    // GET /api/research-cases/{id}
    public function show($id)
    {
        $case = ResearchCase::findOrFail($id);

        return response()->json($case);
    }
}
