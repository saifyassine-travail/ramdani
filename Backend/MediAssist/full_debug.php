<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;
use Illuminate\Support\Facades\DB;

// Find all patients with multiple appointments
$patients = DB::table('appointments')
    ->select('ID_patient', DB::raw('count(*) as cnt'))
    ->groupBy('ID_patient')
    ->having('cnt', '>', 1)
    ->orderBy('cnt', 'desc')
    ->get();

echo "=== PATIENTS WITH MULTIPLE APPOINTMENTS ===\n";
foreach ($patients as $p) {
    echo "Patient " . $p->ID_patient . ": " . $p->cnt . " appointments\n";
    
    $appts = Appointment::where('ID_patient', $p->ID_patient)
        ->with(['caseDescription', 'medicaments', 'analyses'])
        ->orderBy('appointment_date', 'asc')
        ->get();

    foreach ($appts as $a) {
        echo "  RV " . $a->ID_RV . " (" . $a->appointment_date . ")\n";
        echo "    Diag: [" . substr($a->diagnostic ?? '', 0, 40) . "]\n";
        echo "    CaseDesc: [" . substr(($a->caseDescription ? $a->caseDescription->case_description : 'NONE'), 0, 40) . "]\n";
        echo "    Meds: " . $a->medicaments->count() . ", Analyses: " . $a->analyses->count() . "\n";
    }
    echo "\n";
}
