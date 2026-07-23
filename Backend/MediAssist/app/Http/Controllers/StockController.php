<?php
namespace App\Http\Controllers;

use App\Models\StockItem;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class StockController extends Controller
{
    public function search(Request $request)
    {
        $term = $request->query('term');

        if (empty($term)) {
            return response()->json([]);
        }

        $items = StockItem::query()
            ->where(function ($query) use ($term) {
                $query->where('name', 'ILIKE', "%{$term}%")
                      ->orWhere('supplier', 'ILIKE', "%{$term}%");
            })
            ->select([
                'ID_Stock as id',
                'name',
                'quantity',
                'threshold',
                'unit',
                'supplier',
                'purchase_price',
                'expiration_date',
            ])
            ->orderBy('name')
            ->limit(15)
            ->get();

        return response()->json($items);
    }

    // GET /api/stock
    public function index(Request $request)
    {
        $showArchived = $request->boolean('archived', false);
        $perPage = max(1, min((int) $request->query('per_page', 50), 100));

        $items = StockItem::query()
            ->where('archived', $showArchived ? 1 : 0)
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
                'per_page' => $items->perPage(),
            ],
        ]);
    }

    // POST /api/stock
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:0',
            'threshold' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:100',
            'supplier' => 'nullable|string|max:255',
            'purchase_price' => 'nullable|numeric|min:0',
            'expiration_date' => 'nullable|date',
        ]);

        $validated['archived'] = 0;

        $item = StockItem::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Article ajouté au stock avec succès!',
            'data' => $item,
        ]);
    }

    // PUT /api/stock/{id}
    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:0',
            'threshold' => 'nullable|integer|min:0',
            'unit' => 'nullable|string|max:100',
            'supplier' => 'nullable|string|max:255',
            'purchase_price' => 'nullable|numeric|min:0',
            'expiration_date' => 'nullable|date',
        ]);

        $item = StockItem::findOrFail($id);
        $item->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Article modifié avec succès!',
            'data' => $item,
        ]);
    }

    // PATCH /api/stock/{id}/archive
    public function archive($id)
    {
        $item = StockItem::findOrFail($id);
        $item->update(['archived' => 1]);

        return response()->json([
            'success' => true,
            'message' => 'Article archivé avec succès!',
            'data' => $item,
        ]);
    }

    // PATCH /api/stock/{id}/restore
    public function restore($id)
    {
        $item = StockItem::findOrFail($id);
        $item->update(['archived' => 0]);

        return response()->json([
            'success' => true,
            'message' => 'Article restauré avec succès!',
            'data' => $item,
        ]);
    }

    // PATCH /api/stock/{id}/adjust-quantity
    public function adjustQuantity(Request $request, $id)
    {
        $validated = $request->validate([
            'delta' => 'required|integer',
        ]);

        $item = StockItem::findOrFail($id);
        $item->quantity = max(0, $item->quantity + $validated['delta']);
        $item->save();

        return response()->json([
            'success' => true,
            'message' => 'Quantité mise à jour',
            'data' => $item,
        ]);
    }
}
