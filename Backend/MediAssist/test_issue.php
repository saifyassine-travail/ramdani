<?php 
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$last = \App\Models\Appointment::with('caseDescription', 'medicaments')
        ->orderBy('appointment_date', 'desc')
        ->first();

// Just get an appointment ID that has multiple to test the function manually
$current = \App\Models\Appointment::find(155);

// Let's test the query used in AppointmentController
$query = \App\Models\Appointment::where('ID_patient', $current ? $current->ID_patient : 0)
    ->where('ID_RV', '!=', 155)
    ->with([
        'medicaments' => function ($q) {
            $q->withPivot('dosage', 'frequence', 'duree');
        },
        'analyses',
        'caseDescription'
    ])
    ->orderBy('appointment_date', 'desc')
    ->first();

echo json_encode([
    'from_query_case' => $query && $query->caseDescription ? $query->caseDescription->case_description : 'none',
    'from_query_meds' => $query ? count($query->medicaments) : 0,
    'current_patient' => $current ? $current->ID_patient : 'none'
]);
