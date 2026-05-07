<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Medicament;
use Illuminate\Support\Facades\DB;

$med = Medicament::where('name', 'LIKE', '%ABIRATERONE%')->first();
if (!$med) {
    echo "Medicament not found\n";
    // Check all medicaments names just in case
    $all = Medicament::take(20)->get(['name']);
    foreach($all as $m) echo "  - " . $m->name . "\n";
    exit;
}

echo "Med ID: " . $med->ID_Medicament . " Name: " . $med->name . "\n";

$appointments = DB::table('medicament_appointment')
    ->where('ID_Medicament', $med->ID_Medicament)
    ->pluck('ID_RV');

echo "Appointments: " . $appointments->implode(', ') . "\n";

foreach ($appointments as $rvId) {
    $a = App\Models\Appointment::with(['caseDescription', 'patient'])->find($rvId);
    if ($a) {
        echo "RV ID: $rvId Patient: " . $a->ID_patient . " Date: " . $a->appointment_date . "\n";
        echo "  CaseDesc: [" . ($a->caseDescription ? $a->caseDescription->case_description : 'NONE') . "]\n";
        echo "  Diagnostic: [" . $a->diagnostic . "]\n";
    }
}
