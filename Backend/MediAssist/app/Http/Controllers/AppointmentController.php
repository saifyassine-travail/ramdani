<?php

namespace App\Http\Controllers;


use App\Http\Controllers\Controller;
use App\Models\Analysis;
use App\Models\Appointment;
use App\Models\CaseDescription;
use App\Models\Medicament;
use App\Models\Patient;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Barryvdh\DomPDF\Facade\PDF;

class AppointmentController extends Controller
{
    /**
     * GET /api/appointments/{date?}
     * List appointments of a given date (or today if none).
     */
    public function index($date = null)
    {
        try {
            // parse or fallback to today
            try {
                $parsedDate = $date ? Carbon::parse($date)->format('Y-m-d') : Carbon::now()->format('Y-m-d');
            } catch (\Exception $e) {
                Log::warning("Invalid date passed to index: {$date}. Using today.");
                $parsedDate = Carbon::now()->format('Y-m-d');
            }

            $appointments = Appointment::with(['patient', 'caseDescription'])
                ->whereDate('appointment_date', $parsedDate)
                ->orderBy('created_at', 'desc')
                ->get();

            $grouped = $appointments->groupBy('status')->map(function ($group) {
                return $group->values();
            });

            return response()->json([
                'success' => true,
                'date' => $parsedDate,
                'appointments' => $appointments,
                'grouped' => $grouped,
                'count' => $appointments->count(),
            ]);
        } catch (\Exception $e) {
            Log::error("AppointmentController@index error for date {$date}: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des rendez-vous',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/appointments/monthly-counts/{yearMonth}
     * Example: yearMonth = "2025-09"
     */
    public function monthlyCounts($yearMonth)
    {
        try {
            if (!preg_match('/^\d{4}-\d{2}$/', $yearMonth)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid format. Use YYYY-MM.',
                ], 400);
            }
            [$year, $month] = explode('-', $yearMonth);

            $driver = config('database.default');
            $dateExpr = $driver === 'pgsql'
                ? "appointment_date::date::text"
                : "DATE(appointment_date)";

            $appointments = Appointment::whereYear('appointment_date', $year)
                ->whereMonth('appointment_date', $month)
                ->selectRaw("{$dateExpr} as date, COUNT(*) as count")
                ->groupBy('appointment_date')
                ->pluck('count', 'date');

            return response()->json([
                'success' => true,
                'data' => $appointments,
            ]);
        } catch (\Exception $e) {
            Log::error("monthlyCounts error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur serveur',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/appointments/update-status
     * Body: { appointment_id, status }
     */
    public function updateStatus(Request $request)
    {
        try {
            $validated = $request->validate([
                'appointment_id' => 'required|integer|exists:appointments,ID_RV',
                'status' => 'required|string|in:scheduled,waiting,preparing,consulting,completed,canceled',
            ]);

            // if switching to consulting, ensure only one ongoing consultation allowed
            if ($request->status === 'consulting') {
                $currentConsultingCount = Appointment::where('status', 'En consultation')
                    ->whereDate('appointment_date', Carbon::today())
                    ->where('ID_RV', '!=', $request->appointment_id)
                    ->count();

                if ($currentConsultingCount >= 1) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Un patient est déjà en consultation. Terminez-le d’abord.',
                        'error_type' => 'consultation_limit',
                    ], 422);
                }
            }

            $statusMapping = [
                'scheduled' => 'Programmé',
                'waiting' => 'Salle dattente',
                'preparing' => 'En préparation',
                'consulting' => 'En consultation',
                'completed' => 'Terminé',
                'canceled' => 'Annulé',
            ];

            $appointment = Appointment::where('ID_RV', $validated['appointment_id'])->firstOrFail();
            
            // Set timestamps based on status transition
            if ($validated['status'] === 'consulting' && !$appointment->consultation_started_at) {
                $appointment->consultation_started_at = now();
            }
            if ($validated['status'] === 'completed' && !$appointment->consultation_ended_at) {
                $appointment->consultation_ended_at = now();
            }

            $appointment->status = $statusMapping[$validated['status']];
            $appointment->save();
            
            // Clear statistics cache if status changed to/from 'Terminé'
            \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

            // optionally return styling classes or whatever the frontend needs
            $statusColors = [
                'Programmé' => 'bg-blue-100 border-blue-400 text-blue-700',
                'Salle dattente' => 'bg-yellow-100 border-yellow-400 text-yellow-700',
                'En préparation' => 'bg-orange-100 border-orange-400 text-orange-700',
                'En consultation' => 'bg-purple-100 border-purple-400 text-purple-700',
                'Terminé' => 'bg-green-100 border-green-400 text-green-700',
                'Annulé' => 'bg-red-100 border-red-400 text-red-700',
            ];

            $colorClasses = explode(' ', $statusColors[$appointment->status] ?? '');

            return response()->json([
                'success' => true,
                'status' => $appointment->status,
                'colors' => [
                    'bg' => $colorClasses[0] ?? null,
                    'border' => $colorClasses[1] ?? null,
                    'text' => $colorClasses[2] ?? null,
                ],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error("updateStatus exception: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour du statut',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/appointments/toggle-mutuelle
     * Body: { appointment_id }
     */
    public function toggleMutuelle(Request $request)
    {
        try {
            $validated = $request->validate([
                'appointment_id' => 'required|integer|exists:appointments,ID_RV',
            ]);

            $appointment = Appointment::findOrFail($validated['appointment_id']);
            $appointment->mutuelle = ! $appointment->mutuelle;
            $appointment->save();

            return response()->json([
                'success' => true,
                'mutuelle' => $appointment->mutuelle,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error("toggleMutuelle error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du basculement de mutuelle',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PUT /api/appointments/{id}/details
     * Body: includes case_description, vital signs, medicaments, analyses, diagnostic, etc.
     */
    public function editAppointmentDetails(Request $request, $id)
    {
        try {
            DB::beginTransaction();

            $appointment = Appointment::findOrFail($id);

            $validated = $request->validate([
                'case_description' => 'nullable|string',
                'weight' => 'nullable|numeric|min:0|max:300',
                'pulse' => 'nullable|numeric|min:0|max:200',
                'temperature' => 'nullable|numeric|max:45',
                'blood_pressure' => 'nullable|string|max:20',
                'tall' => 'nullable|numeric|min:0|max:250',
                'spo2' => 'nullable|numeric|min:0|max:100',
                'DDR' => 'nullable|date',
                'notes' => 'nullable|string|max:255',
                'custom_measures_values' => 'nullable|array',
                'diagnostic' => 'nullable|string',
                'medicaments' => 'nullable|array',
                'medicaments.*.ID_Medicament' => 'required_with:medicaments|exists:medicaments,ID_Medicament',
                'medicaments.*.dosage' => 'nullable|string|max:50',
                'medicaments.*.frequence' => 'nullable|string|max:50',
                'medicaments.*.duree' => 'nullable|string|max:50',
                'analyses' => 'nullable|array',
                'analyses.*.ID_Analyse' => 'required_with:analyses|exists:analyses,ID_Analyse',
            ]);

            // Update diagnostic
            $appointment->diagnostic = $request->input('diagnostic');
            $appointment->save();

            // Update Patient DDR if present
            if ($request->has('DDR')) {
                $appointment->patient->update(['DDR' => $request->input('DDR')]);
            }

            // Update or create case description
           $caseData = [
    'case_description' => $request->input('case_description'),
    'weight' => $request->input('weight'),
    'pulse' => $request->input('pulse'),
    'temperature' => $request->input('temperature'),
    'blood_pressure' => $request->input('blood_pressure'),
    'tall' => $request->input('tall'),
    'spo2' => $request->input('spo2'),
    'notes' => $request->input('notes'),
    'custom_measures_values' => $request->has('custom_measures_values') ? json_encode($request->input('custom_measures_values')) : null,
];

// Remove all null or empty fields
$caseData = array_filter($caseData, fn($value) => $value !== null && $value !== '');

if (!empty($caseData)) {
    if ($appointment->caseDescription) {
        $appointment->caseDescription->update($caseData);
    } else {
        $appointment->caseDescription()->create($caseData);
    }
}


            // Sync medicaments
            $medSync = [];
            if ($request->has('medicaments')) {
                foreach ($request->input('medicaments') as $med) {
                    if (!empty($med['ID_Medicament'])) {
                        $medSync[$med['ID_Medicament']] = [
                            'dosage' => $med['dosage'] ?? null,
                            'frequence' => $med['frequence'] ?? null,
                            'duree' => $med['duree'] ?? null,
                        ];
                    }
                }
            }
            $appointment->medicaments()->sync($medSync);

            // Sync analyses (only IDs)
            $analysisIds = $request->has('analyses')
                ? array_column($request->input('analyses'), 'ID_Analyse')
                : [];
            $appointment->analyses()->sync($analysisIds);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Détails du rendez-vous mis à jour avec succès',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("editAppointmentDetails error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour des détails',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/appointments/{ID_RV}/last-info
     * Returns the last appointment (before this one) details: medicaments, analyses, case description, date.
     */
    public function getLastAppointmentInfo($ID_RV)
    {
        try {
            if (!is_numeric($ID_RV)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid appointment ID',
                ], 400);
            }

            $current = Appointment::find($ID_RV);
            if (!$current) {
                return response()->json([
                    'success' => false,
                    'message' => 'Appointment not found',
                ], 404);
            }

            $last = Appointment::where('ID_patient', $current->ID_patient)
                ->where('ID_RV', '!=', $ID_RV)
                ->where(function ($query) use ($current) {
                    $query->whereDate('appointment_date', '<', $current->appointment_date)
                          ->orWhere(function ($q) use ($current) {
                              $q->whereDate('appointment_date', '=', $current->appointment_date)
                                ->where('created_at', '<', $current->created_at);
                          });
                })
                ->with([
                    'medicaments' => function ($q) {
                        $q->withPivot('dosage', 'frequence', 'duree');
                    },
                    'analyses',
                    'caseDescription'
                ])
                ->orderBy('appointment_date', 'desc')
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$last) {
                return response()->json([
                    'success' => false,
                    'message' => 'No previous appointment found',
                ], 404);
            }

            $data = [
                'date' => Carbon::parse($last->appointment_date)->format('d M Y'),
                'medicaments' => $last->medicaments->map(function ($med) {
                    return [
                        'id' => $med->ID_Medicament,
                        'name' => $med->name,
                        'dosage' => $med->pivot->dosage,
                        'frequence' => $med->pivot->frequence,
                        'duree' => $med->pivot->duree,
                    ];
                }),
                'analyses' => $last->analyses->map(fn($a) => [
                    'id' => $a->ID_Analyse,
                    'name' => $a->type_analyse,
                ]),
                'case_description' => optional($last->caseDescription)->case_description ?: 
                                     (optional($last->caseDescription)->notes ?: $last->diagnostic),
                'weight' => optional($last->caseDescription)->weight,
                'tall' => optional($last->caseDescription)->tall,
                'temperature' => optional($last->caseDescription)->temperature,
                'pulse' => optional($last->caseDescription)->pulse,
                'blood_pressure' => optional($last->caseDescription)->blood_pressure,
                'custom_measures_values' => optional($last->caseDescription)->custom_measures_values,
            ];

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            Log::error("getLastAppointmentInfo error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Server error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/appointments/update-price
     * Body: { appointment_id, price }
     */
    public function updatePrice(Request $request)
    {
        try {
            $validated = $request->validate([
                'appointment_id' => 'required|integer|exists:appointments,ID_RV',
                'price' => 'required|numeric|min:0',
                'medical_acts' => 'nullable|array',
            ]);

            $appointment = Appointment::findOrFail($validated['appointment_id']);
            $appointment->payement = $validated['price'];
            
            if (array_key_exists('medical_acts', $validated)) {
                $appointment->medical_acts = $validated['medical_acts'];
            }

            $appointment->save();
            
            // Clear statistics cache
            \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

            return response()->json([
                'success' => true,
                'message' => 'Price updated successfully',
                'price' => $appointment->payement,
                'medical_acts' => $appointment->medical_acts,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error("updatePrice error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur mise à jour prix',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/appointments/{id}/ordonnance
     * Returns PDF download of ordonnance (prescription).
     */
    public function generateOrdonnance($id)
    {
        $appointment = Appointment::with(['patient', 'medicaments'])->findOrFail($id);

        if ($appointment->medicaments->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun médicament associé',
            ], 404);
        }

        $pdf = PDF::loadView('ordonnance', compact('appointment'));
        // Return PDF as a download
        return $pdf->download('ordonnance_' . $appointment->ID_RV . '.pdf');
    }

    /**
     * GET /api/appointments/{id}/analysis-pdf
     * Returns PDF download of analyses.
     */
    public function generateAnalysis($id)
    {
        $appointment = Appointment::with(['patient', 'analyses'])->findOrFail($id);

        if ($appointment->analyses->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Aucune analyse associée',
            ], 404);
        }

        $pdf = PDF::loadView('analyse', compact('appointment'));
        return $pdf->download('analyse_' . $appointment->ID_RV . '.pdf');
    }

    /**
     * GET /api/appointments/{id}/edit-data
     * Returns data necessary to edit an appointment (patient, case description, medicaments, analyses lists).
     */
    public function showEditData($id)
    {
        try {
            $appointment = Appointment::with(['patient', 'caseDescription', 'medicaments', 'analyses'])->findOrFail($id);
            $availableMedicaments = Medicament::all();
            $availableAnalyses = Analysis::all();

            return response()->json([
                'success' => true,
                'data' => [
                    'appointment' => $appointment,
                    'available_medicaments' => $availableMedicaments,
                    'available_analyses' => $availableAnalyses,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error("showEditData error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur récupération données pour l’édition',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/medicaments/search?q=...
     */
    public function searchMedicaments(Request $request)
    {
        try {
            $term = $request->get('q', '');
            $results = Medicament::where('name', 'like', '%' . $term . '%')
                ->get(['ID_Medicament as id', 'name as text']);

            return response()->json([
                'success' => true,
                'data' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error("searchMedicaments error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur recherche médicaments',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/analyses/search?q=...
     */
    public function searchAnalyses(Request $request)
    {
        try {
            $term = $request->get('q', '');
            $results = Analysis::where('type_analyse', 'like', '%' . $term . '%')
                ->get(['ID_Analyse as id', 'type_analyse as text']);

            return response()->json([
                'success' => true,
                'data' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error("searchAnalyses error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur recherche analyses',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the credit (rest) for an appointment.
     */
    public function updateCredit(Request $request)
    {
        $validated = $request->validate([
            'id_appointment' => 'required|integer|exists:appointments,ID_RV',
            'credit' => 'required|numeric|min:0',
        ]);

        $appointment = Appointment::findOrFail($validated['id_appointment']);
        $appointment->credit = $validated['credit'];
        $appointment->save();

        // Clear statistics cache
        \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

        return response()->json([
            'success' => true,
            'message' => 'Crédit mis à jour avec succès',
        ]);
    }

    /**
     * POST /api/appointments (create a new appointment) — simpler version
     */
    public function storeV1(Request $request)
{
    try {
        $validated = $request->validate([
            'patient_id' => 'required|integer|exists:patients,ID_patient',
            'type' => 'required|string|in:Consultation,Control',
            'appointment_date' => 'required|date|after_or_equal:today',
            'notes' => 'nullable|string|max:1000',
        ]);

        $patient = Patient::where('ID_patient', $validated['patient_id'])
            ->where('archived', false)
            ->first();

        if (!$patient) {
            return response()->json([
                'success' => false,
                'message' => 'Patient non trouvé ou archivé',
            ], 404);
        }

        // Default payment and credit to 0 as requested
        $payment = 0;
        $credit = 0;

        $appointment = Appointment::create([
            'ID_patient' => $validated['patient_id'],
            'type' => $validated['type'],
            'appointment_date' => $validated['appointment_date'],
            'status' => 'Programmé',
            'mutuelle' => strtoupper($patient->mutuelle ?? '') === 'ONE',
            'payement' => $payment,
            'credit' => $credit,
            'notes' => $validated['notes'],
        ]);

        // Clear statistics cache
        \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

        return response()->json([
            'success' => true,
            'message' => 'Rendez-vous créé avec succès',
            'appointment' => $appointment,
        ]);
    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $e->errors(),
        ], 422);
    } catch (\Exception $e) {
        Log::error("storeV1 error: " . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Erreur création rendez-vous',
            'error' => $e->getMessage(),
        ], 500);
    }
}


    /**
     * POST /api/appointments (create — full version)
     */
public function store(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'patient_id' => 'required|exists:patients,ID_patient',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Le patient sélectionné n\'existe pas',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $request->validate([
            'patient_id' => 'required|exists:patients,ID_patient',
            'appointment_type' => 'required|in:consultation,controle',
            'appointment_date_hidden' => 'required|date_format:Y-m-d',
            'patient_notes' => 'nullable|string',
            'mutuelle' => 'nullable|string', // added this line
        ]);

        $patient = Patient::find($validated['patient_id']);
        if (!$patient) {
            return response()->json([
                'success' => false,
                'message' => 'Patient introuvable',
            ], 404);
        }

        $formattedDate = Carbon::createFromFormat('Y-m-d', $validated['appointment_date_hidden'])
            ->setTime(12, 0, 0);

        // ✅ Create the appointment with default 0 payment and credit
        $appointment = Appointment::create([
            'ID_patient' => $validated['patient_id'],
            'type' => $validated['appointment_type'] === 'consultation' ? 'Consultation' : 'Control',
            'appointment_date' => $formattedDate,
            'diagnostic' => '',
            'status' => 'Programmé',
            'mutuelle' => strtolower($validated['mutuelle'] ?? '') === 'one',
            'payement' => 0,
            'credit' => 0,
        ]);

        if (!empty($validated['patient_notes'])) {
            $patient->notes = $validated['patient_notes'];
            $patient->save();
        }

        // Clear statistics cache
        \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

        return response()->json([
            'success' => true,
            'message' => 'Rendez-vous ajouté avec succès pour ' . $patient->name,
            'appointment' => $appointment,
        ]);

    } catch (\Exception $e) {
        Log::error("store error: " . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Erreur lors de la création du rendez-vous',
            'error' => $e->getMessage(),
        ], 500);
    }
}

    /**
     * POST /api/appointments/{id}/add-control
     * Adds a "control" appointment 3 months minus 10 days ahead (skipping Sunday)
     */
    public function addControl($id)
    {
        try {
            $patient = Patient::findOrFail($id);

            $date = Carbon::today()->addMonths(3)->subDays(10);
            if ($date->isSunday()) {
                $date->addDay();
            }

            $appointment = Appointment::create([
                'ID_patient' => $patient->ID_patient,
                'appointment_date' => $date,
                'type' => 'Control',
                'status' => 'Programmé',
            ]);

            // Clear statistics cache
            \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

            return response()->json([
                'success' => true,
                'message' => 'Rendez-vous de contrôle ajouté pour le ' . $date->format('d/m/Y'),
                'appointment' => $appointment,
            ]);
        } catch (\Exception $e) {
            Log::error("addControl error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur ajout contrôle',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/patients/search?term=...
     * Search patients for autocomplete
     */
    public function search(Request $request)
    {
        try {
            $term = $request->get('term', '');
            if (strlen($term) < 2) {
                return response()->json(['success' => true, 'data' => []]);
            }

            $patients = Patient::where('name', 'like', '%' . $term . '%')
                ->where('archived', false)
                ->select('ID_patient as id', 'name', 'phone_num as phone')
                ->limit(10)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $patients,
            ]);
        } catch (\Exception $e) {
            Log::error("search patient error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la recherche de patients',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    /**
 * PUT /api/appointments/{id}
 * Update an existing appointment
 */
public function update(Request $request, $id)
{
    try {
        $appointment = Appointment::findOrFail($id);

        $validated = $request->validate([
            'type' => 'nullable|string|in:Consultation,Control',
            'appointment_date' => 'nullable|date|after_or_equal:today',
            'diagnostic' => 'nullable|string|max:1000',
            'notes' => 'nullable|string|max:1000',
            'status' => 'nullable|string|in:Programmé,Salle dattente,En préparation,En consultation,Terminé,Annulé',
        ]);

        if (isset($validated['type'])) {
            $appointment->type = $validated['type'];
        }

        if (isset($validated['appointment_date'])) {
            $appointment->appointment_date = $validated['appointment_date'];
        }

        if (isset($validated['diagnostic'])) {
            $appointment->diagnostic = $validated['diagnostic'];
        }

        if (isset($validated['notes'])) {
            $appointment->notes = $validated['notes'];
        }

        if (isset($validated['status'])) {
            $appointment->status = $validated['status'];
        }

        $appointment->save();

        // Clear statistics cache
        \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

        return response()->json([
            'success' => true,
            'message' => 'Rendez-vous mis à jour avec succès',
            'appointment' => $appointment,
        ]);
    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $e->errors(),
        ], 422);
    } catch (\Exception $e) {
        Log::error("updateAppointment error: " . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Erreur lors de la mise à jour du rendez-vous',
            'error' => $e->getMessage(),
        ], 500);
    }
}

/**
 * DELETE /api/appointments/{id}
 * Delete an appointment
 */
public function destroy($id)
{
    try {
        $appointment = Appointment::findOrFail($id);
        $appointment->delete();

        // Clear statistics cache
        \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

        return response()->json([
            'success' => true,
            'message' => 'Rendez-vous supprimé avec succès',
        ]);
    } catch (\Exception $e) {
        Log::error("deleteAppointment error: " . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Erreur lors de la suppression du rendez-vous',
            'error' => $e->getMessage(),
        ], 500);
    }
}




public function quickAddAppointment(Request $request)
{
    try {
        $validated = $request->validate([
            'patient_id' => 'required|integer|exists:patients,ID_patient',
            'days_from_now' => 'required|integer|min:0',
        ]);

        $patient = Patient::where('ID_patient', $validated['patient_id'])
            ->where('archived', false)
            ->first();

        if (!$patient) {
            return response()->json([
                'success' => false,
                'message' => 'Patient non trouvé ou archivé',
            ], 404);
        }

        // Calculate the appointment date
        $appointmentDate = Carbon::today()->addDays($validated['days_from_now']);

        // Skip Saturday (6) and Sunday (0)
        while (in_array($appointmentDate->dayOfWeek, [Carbon::SUNDAY])) {
            $appointmentDate->addDay();
        }

        // Create the control appointment
        $appointment = Appointment::create([
            'ID_patient' => $patient->ID_patient,
            'type' => 'Control',
            'appointment_date' => $appointmentDate->toDateString(),
            'status' => 'Programmé',
            'mutuelle' => false,
            'payement' => 0, // Control appointments are free
            'notes' => null,
        ]);

        // Clear statistics cache
        \Illuminate\Support\Facades\Cache::forget('dashboard_stats_v1');

        return response()->json([
            'success' => true,
            'message' => 'Rendez-vous de contrôle ajouté avec succès',
            'appointment' => $appointment,
        ]);
    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $e->errors(),
        ], 422);
    } catch (\Exception $e) {
        Log::error("quickAddAppointment error: " . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Erreur création rendez-vous',
            'error' => $e->getMessage(),
        ], 500);
    }
}

public function countAppointmentsByDate($date)
{
    try {
        // Make sure the date format is valid
        $parsedDate = \Carbon\Carbon::createFromFormat('Y-m-d', $date);

        // Count appointments for that day
        $count = Appointment::whereDate('appointment_date', $parsedDate)->count();

        return response()->json([
            'success' => true,
            'date' => $parsedDate->format('Y-m-d'),
            'count' => $count,
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Erreur lors du calcul du nombre de rendez-vous',
            'error' => $e->getMessage(),
        ], 500);
    }
}

public function getLastMedicamentsByPatient($patientId)
{
    try {
        if (!is_numeric($patientId)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid patient ID',
            ], 400);
        }

        // Get latest appointment that has medicaments
        $appointment = Appointment::where('ID_patient', $patientId)
            ->with(['medicaments' => function ($q) {
                $q->withPivot('dosage', 'frequence', 'duree');
            }])
            ->orderBy('appointment_date', 'desc')
            ->first();

        if (!$appointment) {
            return response()->json([
                'success' => false,
                'message' => 'No appointment found for this patient',
            ], 404);
        }

        if ($appointment->medicaments->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'The last appointment has no medicaments',
            ], 404);
        }

        // Reformat medicaments nicely
        $medicaments = $appointment->medicaments->map(function ($med) {
            return [
                'id' => $med->ID_Medicament,
                'name' => $med->name,
                'dosage' => $med->pivot->dosage,
                'frequence' => $med->pivot->frequence,
                'duree' => $med->pivot->duree,
            ];
        });

        return response()->json([
            'success' => true,
            'date' => $appointment->appointment_date,
            'medicaments' => $medicaments,
        ]);

    } catch (\Exception $e) {
        \Log::error("getLastMedicamentsByPatient error: " . $e->getMessage());

        return response()->json([
            'success' => false,
            'message' => 'Server error',
            'error' => $e->getMessage(),
        ], 500);
    }
}




}
