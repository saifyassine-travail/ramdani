<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Analysis;
use Illuminate\Support\Facades\DB;

$anal = Analysis::where('type_analyse', 'LIKE', '%HDL%')->first();
if (!$anal) {
    echo "Analysis not found\n";
    exit;
}

echo "Anal ID: " . $anal->ID_Analyse . " Name: " . $anal->type_analyse . "\n";

$appointments = DB::table('analysis_appointment')
    ->where('ID_Analyse', $anal->ID_Analyse)
    ->pluck('ID_RV');

echo "Appointments: " . $appointments->implode(', ') . "\n";

foreach ($appointments as $rvId) {
    $a = App\Models\Appointment::with(['caseDescription', 'patient', 'medicaments'])->find($rvId);
    if ($a) {
        echo "RV ID: $rvId Patient: " . $a->ID_patient . " Date: " . $a->appointment_date . "\n";
        echo "  CaseDesc: [" . ($a->caseDescription ? $a->caseDescription->case_description : 'NONE') . "]\n";
        echo "  Diagnostic: [" . $a->diagnostic . "]\n";
        echo "  Meds: " . $a->medicaments->pluck('name')->implode(', ') . "\n";
    }
}
