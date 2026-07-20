<?php

namespace App\Http\Controllers;

use App\Models\PatientDocument;
use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class PatientDocumentController extends Controller
{
    public function index($patientId)
    {
        try {
            $documents = PatientDocument::where('ID_patient', $patientId)
                ->orderBy('uploaded_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $documents,
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching patient documents: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch documents',
            ], 500);
        }
    }

    public function store(Request $request, $patientId)
    {
        try {
            $request->validate([
                'file' => 'required|file|max:10240', // 10MB max
                'document_type' => 'nullable|string',
            ]);

            $file = $request->file('file');
            $originalName = $file->getClientOriginalName();
            
            // Store file in storage/app/patient_documents/{patientId}/
            $path = $file->store("patient_documents/{$patientId}", 'local');

            $document = PatientDocument::create([
                'ID_patient' => $patientId,
                'document_name' => $originalName,
                'document_type' => $request->input('document_type', 'general'),
                'file_path' => $path,
                'file_size' => $file->getSize(),
            ]);

            return response()->json([
                'success' => true,
                'data' => $document,
                'message' => 'Document uploaded successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Error uploading document: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload document',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function download($patientId, $documentId)
    {
        try {
            $document = PatientDocument::findOrFail($documentId);

            if (!Storage::exists($document->file_path)) {
                return response()->json([
                    'success' => false,
                    'message' => 'File not found',
                ], 404);
            }

            return Storage::download($document->file_path, $document->document_name);
        } catch (\Exception $e) {
            Log::error('Error downloading document: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to download document',
            ], 500);
        }
    }

    public function destroy($patientId, $documentId)
    {
        try {
            $document = PatientDocument::findOrFail($documentId);

            // Delete file from storage
            if (Storage::exists($document->file_path)) {
                Storage::delete($document->file_path);
            }

            $document->delete();

            return response()->json([
                'success' => true,
                'message' => 'Document deleted successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('Error deleting document: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete document',
            ], 500);
        }
    }
}
