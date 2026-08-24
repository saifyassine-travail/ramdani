<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;

class PatientSummaryController extends Controller
{
    public function summarize($id)
    {
        // Ollama generation can take a while on CPU — matches the
        // microservice's own gunicorn --timeout (see Backend/patient-summary-service/Dockerfile).
        $response = Http::timeout(130)
            ->post(config('services.summary.url') . "/api/patients/{$id}/summary");

        return response()->json($response->json(), $response->status());
    }
}
