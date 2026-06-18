<?php
namespace App\Http\Controllers;

use App\Models\Medicament;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class MedicamentController extends Controller



{

   public function search(Request $request)
{
    $term = $request->query('term');

    if (empty($term)) {
        return response()->json([]);
    }

    $medicaments = Medicament::query()
        ->where(function ($query) use ($term) {
            $query->where('name', 'ILIKE', "%{$term}%")
                  ->orWhere('dosage', 'ILIKE', "%{$term}%")
                  ->orWhere('composition', 'ILIKE', "%{$term}%")
                  ->orWhere('type', 'ILIKE', "%{$term}%")
                  ->orWhere('type_category', 'ILIKE', "%{$term}%");
        })
        ->select([
            'ID_Medicament as id',
            'name',
            'price',
            'prix_hospitalier',
            'dosage',
            'composition',
            'Classe_thérapeutique',
            'Code_ATCv',
            'type',
            'type_category',
            'laboratory',
            'statut',
        ])
        ->orderBy('name')
        ->limit(15)
        ->get();

    return response()->json($medicaments);
}

    // GET /api/medicaments
    public function index(Request $request)
    {
        $showArchived = $request->boolean('archived', false);
        $perPage = max(1, min((int) $request->query('per_page', 50), 100));

        $medicaments = Medicament::query()
            ->where('archived', $showArchived ? 1 : 0)
            ->select([
                'ID_Medicament',
                'name',
                'price',
                'prix_hospitalier',
                'dosage',
                'composition',
                'Classe_thérapeutique',
                'Code_ATCv',
                'type',
                'type_category',
                'laboratory',
                'statut',
                'archived',
                'is_favorite',
                'created_at',
                'updated_at',
            ])
            ->orderByDesc('is_favorite')
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $medicaments->items(),
            'meta' => [
                'current_page' => $medicaments->currentPage(),
                'last_page' => $medicaments->lastPage(),
                'total' => $medicaments->total(),
                'per_page' => $medicaments->perPage(),
            ],
        ]);
    }

    // POST /api/medicaments
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric',
            'dosage' => 'nullable|string|max:255',
            'composition' => 'nullable|string',
        ]);

        $validated['archived'] = 0;

        $medicament = Medicament::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Médicament ajouté avec succès!',
            'data' => $medicament
        ]);
    }

    // PUT /api/medicaments/{id}
    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric',
            'dosage' => 'nullable|string|max:255',
            'composition' => 'nullable|string',
        ]);

        $medicament = Medicament::findOrFail($id);
        $medicament->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Médicament modifié avec succès!',
            'data' => $medicament
        ]);
    }

    // PATCH /api/medicaments/{id}/archive
    public function archive($id)
    {
        $medicament = Medicament::findOrFail($id);
        $medicament->update(['archived' => 1]);

        return response()->json([
            'success' => true,
            'message' => 'Médicament archivé avec succès!',
            'data' => $medicament
        ]);
    }

    // PATCH /api/medicaments/{id}/restore
    public function restore($id)
    {
        $medicament = Medicament::findOrFail($id);
        $medicament->update(['archived' => 0]);

        return response()->json([
            'success' => true,
            'message' => 'Médicament restauré avec succès!',
            'data' => $medicament
        ]);
    }

    // PATCH /api/medicaments/{id}/favorite
    public function toggleFavorite($id)
    {
        $medicament = Medicament::findOrFail($id);
        $medicament->update(['is_favorite' => !$medicament->is_favorite]);

        return response()->json([
            'success' => true,
            'message' => $medicament->is_favorite ? 'Ajouté aux favoris!' : 'Retiré des favoris!',
            'data' => $medicament
        ]);
    }
}
