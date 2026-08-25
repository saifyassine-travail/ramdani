<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PatientController extends Controller
{
    public function show(string $id)
    {
        $patient = Patient::with(['Appointment', 'lastAppointment', 'nextAppointment'])
                          ->findOrFail($id);

        $appointmentsHistory = $patient->Appointment->sortByDesc('appointment_date');
        $lastAppointment = $patient->lastAppointment;
        $nextAppointment = $patient->nextAppointment;

        return response()->json([
            'patient' => $patient,
            'appointmentsHistory' => $appointmentsHistory->values(),
            'lastAppointment' => $lastAppointment,
            'nextAppointment' => $nextAppointment,
        ]);
    }

    public function index(Request $request)
    {
        $showArchived = $request->boolean('archived', false);

        // Whitelist of sortable columns -> actual SQL column. 'last_appointment_date'
        // is handled separately below since it isn't a plain column (it comes from
        // the lastAppointment hasOne relation).
        $sortableColumns = [
            'first_name' => 'first_name',
            'birth_day' => 'birth_day',
            'created_at' => 'created_at',
        ];

        $sortBy = $request->input('sort_by', 'first_name');
        $sortDir = strtolower((string) $request->input('sort_dir', 'asc'));
        if (!in_array($sortDir, ['asc', 'desc'], true)) {
            $sortDir = 'asc';
        }

        $query = Patient::with(['lastAppointment', 'nextAppointment'])
            ->where('archived', $showArchived);

        if ($request->filled('gender') && in_array($request->input('gender'), ['Male', 'Female'], true)) {
            $query->where('gender', $request->input('gender'));
        }

        if ($request->has('mutuelle')) {
            if ($request->boolean('mutuelle')) {
                $query->whereNotNull('mutuelle')->where('mutuelle', '!=', '');
            } else {
                $query->where(function ($q) {
                    $q->whereNull('mutuelle')->orWhere('mutuelle', '');
                });
            }
        }

        $allowedBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if ($request->filled('blood_type') && in_array($request->input('blood_type'), $allowedBloodTypes, true)) {
            $query->where('blood_type', $request->input('blood_type'));
        }

        // "Reste" — only patients with at least one appointment carrying an
        // outstanding (unpaid) balance.
        if ($request->boolean('has_credit')) {
            $query->whereHas('Appointment', function ($q) {
                $q->where('credit', '>', 0);
            });
        }

        // Age filters, computed from birth_day. Mirrors the age-bucket SQL used in
        // StatisticsController::getDashboardStats() for consistency (pgsql age()).
        if ($request->filled('min_age') || $request->filled('max_age')) {
            $dbDriver = config('database.default');
            $ageSql = $dbDriver === 'pgsql'
                ? 'EXTRACT(YEAR FROM age(CURRENT_DATE, birth_day))'
                : 'TIMESTAMPDIFF(YEAR, birth_day, CURDATE())';

            $query->whereNotNull('birth_day');

            if ($request->filled('min_age')) {
                $query->whereRaw("{$ageSql} >= ?", [(int) $request->input('min_age')]);
            }
            if ($request->filled('max_age')) {
                $query->whereRaw("{$ageSql} <= ?", [(int) $request->input('max_age')]);
            }
        }

        if ($sortBy === 'last_appointment_date') {
            // hasOne relation, not a plain column: sort via a correlated subquery
            // that pulls the most recent past appointment date per patient.
            $query->addSelect(['last_appointment_date_sort' => \App\Models\Appointment::selectRaw('MAX(appointment_date)')
                ->whereColumn('appointments.ID_patient', 'patients.ID_patient')
                ->where('appointment_date', '<=', now()),
            ]);
            // Patients with no past appointment (NULL) always sort last, regardless
            // of direction — ORDER BY alone would otherwise put NULLs first on DESC
            // (Postgres default), burying patients who actually have a last visit.
            // Note: Postgres only allows a bare output-alias reference in ORDER BY
            // (not the alias embedded inside another expression like CASE WHEN),
            // so NULLS LAST is used instead of a CASE-based tiebreaker.
            if (config('database.default') === 'pgsql') {
                $query->orderByRaw("last_appointment_date_sort {$sortDir} NULLS LAST");
            } else {
                $query->orderByRaw('last_appointment_date_sort IS NULL')
                    ->orderBy('last_appointment_date_sort', $sortDir);
            }
        } elseif (array_key_exists($sortBy, $sortableColumns)) {
            $query->orderBy($sortableColumns[$sortBy], $sortDir);
        } else {
            $query->orderBy('first_name', $sortDir);
        }

        $patients = $query->paginate(30)->appends($request->query());

        return response()->json($patients);
    }

    /**
     * Minors (under 18) have no CIN of their own; the parent/guardian CIN is
     * stored instead. Age is derived from birth_day.
     */
    private function isMinor(?string $birthDay): bool
    {
        if (empty($birthDay)) {
            return false;
        }
        try {
            return Carbon::parse($birthDay)->age < 18;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function store(Request $request)
{
    $isMinor = $this->isMinor($request->input('birth_day'));

    $validated = $request->validate([
        'first_name' => 'required|string|max:255',
        'last_name' => 'required|string|max:255',
        'birth_day' => 'required|date',
        'gender' => 'required|in:Male,Female',
        'CIN' => [$isMinor ? 'nullable' : 'required', 'string', 'max:255', 'unique:patients,CIN'],
        'guardian_cin' => [$isMinor ? 'required' : 'nullable', 'string', 'max:255'],
        'guardian_relation' => 'nullable|in:father,mother',
        'phone_num' => 'required|string|max:255',
        'email' => 'nullable|email|max:255',
        'mutuelle' => 'nullable|string',
        'allergies' => 'nullable|string',
        'chronic_conditions' => 'nullable|string',
        'notes' => 'nullable|string',
        'blood_type' => 'nullable|string|in:A+,A-,B+,B-,AB+,AB-,O+,O-',
        'photo_base64' => 'nullable|string',
    ]);

    // Normalize values for DB
    $validated['gender'] = ucfirst(strtolower($validated['gender']));
    $validated['CIN'] = !empty($validated['CIN']) ? strtoupper($validated['CIN']) : null;
    $validated['guardian_cin'] = !empty($validated['guardian_cin']) ? strtoupper($validated['guardian_cin']) : null;

    // Keep the two paths mutually exclusive.
    if ($isMinor) {
        $validated['CIN'] = null;
    } else {
        $validated['guardian_cin'] = null;
        $validated['guardian_relation'] = null;
    }

    $validated['archived'] = 0;

    $patient = Patient::create($validated);

    return response()->json([
        'success' => true,
        'message' => 'Patient ajouté avec succès!',
        'patient' => $patient,
    ], 201);
}


    public function update(Request $request, $id)
    {
        $patient = Patient::findOrFail($id);

        $isMinor = $this->isMinor($request->input('birth_day'));

        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'birth_day' => 'required|date',
            'gender' => 'required|in:Male,Female',
            'CIN' => [$isMinor ? 'nullable' : 'required', 'string', 'max:255', 'unique:patients,CIN,' . $id . ',ID_patient'],
            'guardian_cin' => [$isMinor ? 'required' : 'nullable', 'string', 'max:255'],
            'guardian_relation' => 'nullable|in:father,mother',
            'phone_num' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'mutuelle' => 'nullable|string',
            'allergies' => 'nullable|string',
            'chronic_conditions' => 'nullable|string',
            'notes' => 'nullable|string',
            'blood_type' => 'nullable|string|in:A+,A-,B+,B-,AB+,AB-,O+,O-',
            'photo_base64' => 'nullable|string',
        ]);

        $validated['gender'] = ucfirst(strtolower($validated['gender']));
        $validated['CIN'] = !empty($validated['CIN']) ? strtoupper($validated['CIN']) : null;
        $validated['guardian_cin'] = !empty($validated['guardian_cin']) ? strtoupper($validated['guardian_cin']) : null;

        if ($isMinor) {
            $validated['CIN'] = null;
        } else {
            $validated['guardian_cin'] = null;
            $validated['guardian_relation'] = null;
        }

        $patient->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Patient mis à jour avec succès!',
            'patient' => $patient,
        ]);
    }

    public function archive(Request $request, $id)
    {
        $patient = Patient::findOrFail($id);

        $request->validate([
            'archived' => 'required|boolean'
        ]);

        $patient->update([
            'archived' => $request->archived
        ]);

        return response()->json([
            'success' => true,
            'archived' => $patient->archived,
            'message' => $patient->archived
                ? 'Patient archivé avec succès'
                : 'Patient désarchivé avec succès',
        ]);
    }

    public function search(Request $request)
    {
        $term = $request->query('term');
        $showArchived = $request->boolean('archived', false);

        if (empty($term)) {
            return response()->json([]);
        }

        $patients = Patient::query()
            ->where('archived', $showArchived)
            ->where(function ($query) use ($term) {
                $query->where('first_name', 'ILIKE', "%{$term}%")
                    ->orWhere('last_name', 'ILIKE', "%{$term}%")
                    ->orWhere('CIN', 'ILIKE', "%{$term}%")
                    ->orWhere('guardian_cin', 'ILIKE', "%{$term}%")
                    ->orWhere('phone_num', 'ILIKE', "%{$term}%")
                    ->orWhere('email', 'ILIKE', "%{$term}%")
                    ->orWhere('notes', 'ILIKE', "%{$term}%");
            })
            ->with(['lastAppointment', 'nextAppointment'])
            ->select([
                'ID_patient',
                'first_name',
                'last_name',
                'birth_day',
                'CIN',
                'guardian_cin',
                'phone_num',
                'email',
                'gender',
                'archived',
                'blood_type',
                'mutuelle',
                'allergies',
                'chronic_conditions',
                'notes',
            ])
            ->orderBy('first_name')
            ->get()
            ->map(function ($patient) {
                return [
                    'id' => $patient->ID_patient,
                    'ID_patient' => $patient->ID_patient,
                    'first_name' => $patient->first_name,
                    'last_name' => $patient->last_name,
                    'cin' => $patient->CIN,
                    'CIN' => $patient->CIN,
                    'guardian_cin' => $patient->guardian_cin,
                    'phone' => $patient->phone_num,
                    'phone_num' => $patient->phone_num,
                    'email' => $patient->email,
                    'gender' => $patient->gender,
                    'mutuelle' => $patient->mutuelle,
                    'allergies' => $patient->allergies,
                    'chronic_conditions' => $patient->chronic_conditions,
                    'notes' => $patient->notes,
                    'age' => $patient->birth_day ? Carbon::parse($patient->birth_day)->age : null,
                    'last_visit' => $patient->lastAppointment && $patient->lastAppointment->appointment_date
                        ? Carbon::parse($patient->lastAppointment->appointment_date)->format('d/m/Y')
                        : null,
                    'next_visit' => $patient->nextAppointment && $patient->nextAppointment->appointment_date
                        ? Carbon::parse($patient->nextAppointment->appointment_date)->format('d/m/Y')
                        : null,
                    'archived' => $patient->archived,
                    'birth_day' => $patient->birth_day,
                    'blood_type' => $patient->blood_type,
                ];
            });

        return response()->json($patients);
    }

    public function searchV2(Request $request)
    {
        $term = $request->query('term');

        if (empty($term)) {
            return response()->json([]);
        }

        $patients = Patient::where('archived', false)
            ->where(function ($query) use ($term) {
                $query->where('first_name', 'ILIKE', "%{$term}%")
                    ->orWhere('last_name', 'ILIKE', "%{$term}%")
                    ->orWhere('CIN', 'ILIKE', "%{$term}%")
                    ->orWhere('guardian_cin', 'ILIKE', "%{$term}%");
            })
            ->select('ID_patient as id', 'name')
            ->get();

        return response()->json($patients);
    }
}
