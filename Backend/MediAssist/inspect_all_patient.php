<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;

$patientId = 1;

$appointments = Appointment::where('ID_patient', $patientId)
    ->with(['caseDescription', 'medicaments', 'analyses'])
    ->orderBy('appointment_date', 'asc')
    ->get();

foreach ($appointments as $a) {
    echo "ID: " . $a->ID_RV . " Date: " . $a->appointment_date . "\n";
    echo "  Diagnostic: [" . $a->diagnostic . "]\n";
    echo "  CaseDesc: [" . ($a->caseDescription ? $a->caseDescription->case_description : 'NONE') . "]\n";
    echo "  Meds: " . $a->medicaments->pluck('name')->implode(', ') . "\n";
    echo "  Analyses: " . $a->analyses->pluck('type_analyse')->implode(', ') . "\n";
    echo "--------------------\n";
}
