<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

use App\Models\Appointment;
use App\Models\CaseDescription;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$latestAppointments = Appointment::with('caseDescription', 'patient')
    ->orderBy('created_at', 'desc')
    ->limit(10)
    ->get();

foreach ($latestAppointments as $appt) {
    echo "Appt ID: {$appt->ID_RV}, Patient: {$appt->patient->first_name} {$appt->patient->last_name}, Date: {$appt->appointment_date}\n";
    if ($appt->caseDescription) {
        echo "  Case Desc Found: ID {$appt->caseDescription->id}\n";
        echo "  Description text: " . ($appt->caseDescription->case_description ?: "EMPTY") . "\n";
        echo "  Notes text: " . ($appt->caseDescription->notes ?: "EMPTY") . "\n";
    } else {
        echo "  NO Case Desc found for this appointment.\n";
    }
    echo "---------------------------------\n";
}
