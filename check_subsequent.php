<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;

$appt152 = Appointment::with('patient')->find(152);
if (!$appt152) {
    echo "Appt 152 not found.\n";
    exit;
}

$patientId = $appt152->ID_patient;
echo "Appt 152 Patient: {$appt152->patient->first_name} {$appt152->patient->last_name} (ID: $patientId)\n";

$subsequent = Appointment::where('ID_patient', $patientId)
    ->where('appointment_date', '>=', $appt152->appointment_date)
    ->orderBy('appointment_date', 'asc')
    ->orderBy('created_at', 'asc')
    ->get();

foreach ($subsequent as $appt) {
    echo "Appt ID: {$appt->ID_RV}, Date: {$appt->appointment_date}, Created: {$appt->created_at}\n";
}
