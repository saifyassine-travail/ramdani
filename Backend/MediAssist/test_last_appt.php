<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$current = App\Models\Appointment::find(15);
if (!$current) {
    echo "Appointment 15 not found.\n";
    exit;
}

echo "Current: ID_RV=15, patient={$current->ID_patient}, date={$current->appointment_date}\n";

$last = App\Models\Appointment::where('ID_patient', $current->ID_patient)
    ->where('ID_RV', '!=', 15)
    ->with(['caseDescription'])
    ->orderBy('appointment_date', 'desc')
    ->first();

if ($last) {
    echo "Last: ID_RV={$last->ID_RV}, date={$last->appointment_date}\n";
    $caseDesc = optional($last->caseDescription)->case_description;
    echo "CaseDesc (from caseDescription relation): '{$caseDesc}'\n";
    echo "Fallsback: desc='{$last->description}', notes='{$last->notes}'\n";
} else {
    echo "No last appointment found according to logic.\n";

    // Let's see what appts exist for this patient:
    echo "\nAll appts for patient {$current->ID_patient}:\n";
    $all = App\Models\Appointment::where('ID_patient', $current->ID_patient)->get();
    foreach($all as $a) {
        echo " - ID_RV={$a->ID_RV}, date={$a->appointment_date}\n";
    }
}
