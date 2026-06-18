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

        $patients = Patient::with(['lastAppointment', 'nextAppointment'])
            ->where('archived', $showArchived)
            ->orderBy('first_name')
            ->paginate(30);

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
                $query->where('first_name', 'LIKE', "%{$term}%")
                    ->orWhere('last_name', 'LIKE', "%{$term}%")
                    ->orWhere('CIN', 'LIKE', "%{$term}%")
                    ->orWhere('phone_num', 'LIKE', "%{$term}%")
                    ->orWhere('email', 'LIKE', "%{$term}%")
                    ->orWhere('notes', 'LIKE', "%{$term}%");
            })
            ->with(['lastAppointment', 'nextAppointment'])
            ->select([
                'ID_patient',
                'first_name',
                'last_name',
                'birth_day',
                'CIN',
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
            ->limit(15)
            ->get()
            ->map(function ($patient) {
                return [
                    'id' => $patient->ID_patient,
                    'ID_patient' => $patient->ID_patient,
                    'first_name' => $patient->first_name,
                    'last_name' => $patient->last_name,
                    'cin' => $patient->CIN,
                    'CIN' => $patient->CIN,
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

        $patients = Patient::where('first_name', 'LIKE', "%{$term}%")
            ->orWhere('last_name', 'LIKE', "%{$term}%")
            ->orWhere('CIN', 'LIKE', "%{$term}%")
            ->where('archived', false)
            ->select('ID_patient as id', 'name')
            ->limit(10)
            ->get();

        return response()->json($patients);
    }
}
