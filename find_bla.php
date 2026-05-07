<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$results = \DB::table('case_descriptions')
    ->where('case_description', 'like', '%bla%')
    ->orWhere('notes', 'like', '%bla%')
    ->get();

if ($results->isEmpty()) {
    echo "No case descriptions found containing 'bla'.\n";
} else {
    foreach ($results as $row) {
        echo "Found CD ID: {$row->id}, ID_RV: {$row->ID_RV}\n";
        echo "  case_description: '{$row->case_description}'\n";
        echo "  notes: '{$row->notes}'\n";
        
        $appt = \App\Models\Appointment::with('patient')->find($row->ID_RV);
        if ($appt) {
            echo "  Appointment Date: {$appt->appointment_date}\n";
            echo "  Patient: {$appt->patient->first_name} {$appt->patient->last_name} (ID: {$appt->patient->ID_patient})\n";
        }
        echo "------------------\n";
    }
}
