<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;

$id = 156;
$a = Appointment::with(['patient', 'caseDescription', 'medicaments', 'analyses'])->find($id);
if (!$a) {
    die("Appointment $id not found\n");
}

echo "Patient: " . $a->ID_patient . "\n";
echo "Date: " . $a->appointment_date . "\n";
echo "Diagnostic: [" . $a->diagnostic . "]\n";
echo "CaseDesc: [" . ($a->caseDescription ? $a->caseDescription->case_description : 'NONE') . "]\n";
echo "Meds: " . $a->medicaments->pluck('name')->implode(', ') . "\n";
echo "Analyses: " . $a->analyses->pluck('type_analyse')->implode(', ') . "\n";
