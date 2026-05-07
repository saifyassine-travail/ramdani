<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

use App\Models\Appointment;
use App\Models\CaseDescription;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$apptId = 156;
$appt = Appointment::with('caseDescription', 'patient')->find($apptId);

if (!$appt) {
    echo "Appointment $apptId NOT found.\n";
    exit;
}

echo "Appt ID: {$appt->ID_RV}, Patient: {$appt->patient->first_name} {$appt->patient->last_name}, Date: {$appt->appointment_date}\n";
if ($appt->caseDescription) {
    echo "  Case Desc Found: ID {$appt->caseDescription->id}\n";
    echo "  Description text: '" . $appt->caseDescription->case_description . "'\n";
    echo "  Notes text: '" . $appt->caseDescription->notes . "'\n";
} else {
    echo "  NO Case Desc linked via Eloquent hasOne relation.\n";
    
    // Let's check manually in the table
    $manual = \DB::table('case_descriptions')->where('ID_RV', $apptId)->first();
    if ($manual) {
        echo "  MANUAL DB CHECK FOUND ID_RV $apptId in case_descriptions table! ID: {$manual->id}\n";
        echo "  Text: '{$manual->case_description}'\n";
    } else {
        echo "  MANUAL DB CHECK: No entry for ID_RV $apptId in case_descriptions table.\n";
    }
}
echo "---------------------------------\n";

// Check the very last appointment for this patient before 156
$current = $appt;
$last = Appointment::where('ID_patient', $current->ID_patient)
    ->where('ID_RV', '!=', $current->ID_RV)
    ->where(function ($query) use ($current) {
        $query->whereDate('appointment_date', '<', $current->appointment_date)
              ->orWhere(function ($q) use ($current) {
                  $q->whereDate('appointment_date', '=', $current->appointment_date)
                    ->where('created_at', '<', $current->created_at);
              });
    })
    ->orderBy('appointment_date', 'desc')
    ->orderBy('created_at', 'desc')
    ->first();

if ($last) {
    echo "Last Appt ID: {$last->ID_RV}, Date: {$last->appointment_date}\n";
} else {
    echo "No previous appointment found for this patient.\n";
}
