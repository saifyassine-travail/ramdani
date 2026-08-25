<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CustomDocument;
use Illuminate\Http\Request;

class CustomDocumentController extends Controller
{
    /**
     * Derive a short title from HTML content when the caller doesn't supply
     * one — the editor is a free-standing "blank document" (no title field
     * at all), so every document still needs something usable for list views.
     */
    private function deriveTitle(string $content): string
    {
        $plain = trim(preg_replace('/\s+/', ' ', strip_tags($content)));
        if ($plain === '') {
            return 'Document sans titre';
        }

        return mb_strlen($plain) > 60 ? mb_substr($plain, 0, 60) . '…' : $plain;
    }

    /**
     * Store a new custom document
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'nullable|string',
            'content' => 'required|string',
        ]);

        $validated['title'] = trim((string) ($validated['title'] ?? '')) !== ''
            ? $validated['title']
            : $this->deriveTitle($validated['content']);

        $customDocument = CustomDocument::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Document créé avec succès',
            'customDocument' => $customDocument,
        ], 201);
    }

    /**
     * Update an existing custom document's content (and optionally title).
     */
    public function update(Request $request, CustomDocument $customDocument)
    {
        $validated = $request->validate([
            'title' => 'nullable|string',
            'content' => 'required|string',
        ]);

        $validated['title'] = trim((string) ($validated['title'] ?? '')) !== ''
            ? $validated['title']
            : $this->deriveTitle($validated['content']);

        $customDocument->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Document mis à jour avec succès',
            'customDocument' => $customDocument,
        ]);
    }

    /**
     * Delete a custom document
     */
    public function destroy(CustomDocument $customDocument)
    {
        $customDocument->delete();

        return response()->json([
            'success' => true,
            'message' => 'Document supprimé avec succès',
        ]);
    }

    /**
     * Get a single custom document by id.
     */
    public function show(CustomDocument $customDocument)
    {
        return response()->json([
            'success' => true,
            'customDocument' => $customDocument,
        ]);
    }

    /**
     * Get every custom document (the general "Lettres" hub — these are
     * never linked to a patient).
     */
    public function indexAll(Request $request)
    {
        $customDocuments = CustomDocument::orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'customDocuments' => $customDocuments,
        ]);
    }
}
