<?php
namespace App\Http\Controllers;

use App\Models\Analysis;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class AnalysisController extends Controller
{
    // GET /api/analyses
    public function index(Request $request)
    {
        $showArchived = $request->boolean('archived', false);

        $analyses = Analysis::where('archived', $showArchived ? 1 : 0)
            ->orderBy('is_favorite', 'desc')
            ->orderBy('ID_Analyse', 'asc')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $analyses
        ]);
    }

    // POST /api/analyses
    public function store(Request $request)
    {
        $validated = $request->validate([
            'type_analyse' => 'required|string|max:255',
            'departement' => 'required|string',
        ]);

        $validated['archived'] = 0;

        $analyse = Analysis::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Analyse ajoutée avec succès!',
            'data' => $analyse
        ]);
    }

    // PUT /api/analyses/{id}
    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'type_analyse' => 'required|string|max:255',
            'departement' => 'required|string',
        ]);

        $analyse = Analysis::findOrFail($id);
        $analyse->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Analyse modifiée avec succès!',
            'data' => $analyse
        ]);
    }

    // PATCH /api/analyses/{id}/archive
    public function archive($id)
    {
        $analyse = Analysis::findOrFail($id);
        $analyse->update(['archived' => 1]);

        return response()->json([
            'success' => true,
            'message' => 'Analyse archivée avec succès!',
            'data' => $analyse
        ]);
    }

    // PATCH /api/analyses/{id}/restore
    public function restore($id)
    {
        $analyse = Analysis::findOrFail($id);
        $analyse->update(['archived' => 0]);

        return response()->json([
            'success' => true,
            'message' => 'Analyse restaurée avec succès!',
            'data' => $analyse
        ]);
    }

    // DELETE /api/analyses/{id}
    public function destroy($id)
    {
        $analyse = Analysis::findOrFail($id);
        $analyse->delete();

        return response()->json([
            'success' => true,
            'message' => 'Analyse supprimée avec succès!'
        ]);
    }

    // PATCH /api/analyses/{id}/favorite
    public function toggleFavorite($id)
    {
        $analyse = Analysis::findOrFail($id);
        $analyse->update(['is_favorite' => !$analyse->is_favorite]);

        return response()->json([
            'success' => true,
            'message' => $analyse->is_favorite ? 'Ajoutée aux favoris!' : 'Retirée des favoris!',
            'data' => $analyse
        ]);
    }

    public function search(Request $request)
{
    $term = $request->query('term');
    $showArchived = $request->boolean('archived', false);

    if (empty($term)) {
        return response()->json([]);
    }

    $analyses = Analysis::query()
        ->where('archived', $showArchived)
        ->where(function ($query) use ($term) {
            $query->where('type_analyse', 'LIKE', "%{$term}%")
                  ->orWhere('departement', 'LIKE', "%{$term}%");
        })
        ->select([
            'ID_Analyse',
            'type_analyse',
            'departement',
            'archived',
            'is_favorite'
        ])
        ->orderBy('is_favorite', 'desc')
        ->orderBy('type_analyse')
        ->limit(15)
        ->get();

    return response()->json($analyses);
}

}
