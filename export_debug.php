<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;

$apptIds = [156, 1];
$data = [];

foreach ($apptIds as $id) {
    $appt = Appointment::with(['caseDescription', 'medicaments', 'analyses', 'patient'])->find($id);
    if ($appt) {
        $data[$id] = [
            'id' => $appt->ID_RV,
            'date' => $appt->appointment_date,
            'patient_id' => $appt->ID_patient,
            'case_description' => $appt->caseDescription,
            'medicaments' => $appt->medicaments->toArray(),
            'analyses' => $appt->analyses->toArray(),
        ];
    }
}

file_put_contents('appt_debug.json', json_encode($data, JSON_PRETTY_PRINT));
echo "Data exported to appt_debug.json\n";
