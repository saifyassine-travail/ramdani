<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class CinExtractionController extends Controller
{
    public function extract(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'image', 'max:10240'],
        ]);

        $file = $request->file('file');

        $response = Http::attach(
            'file',
            file_get_contents($file->getRealPath()),
            $file->getClientOriginalName()
        )->post(config('services.extraction.url') . '/api/extract/cin/');

        return response()->json($response->json(), $response->status());
    }
}
