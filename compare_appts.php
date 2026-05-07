<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;

function inspectAppt($id) {
    $appt = Appointment::with(['caseDescription', 'medicaments', 'analyses'])->find($id);
    if (!$appt) {
        echo "Appt $id not found.\n";
        return;
    }
    echo "Appt ID: $id\n";
    echo "  Date: {$appt->appointment_date}\n";
    echo "  Desc: '" . optional($appt->caseDescription)->case_description . "'\n";
    echo "  Meds: " . $appt->medicaments->pluck('name')->implode(', ') . "\n";
    echo "  Analyses: " . $appt->analyses->pluck('type_analyse')->implode(', ') . "\n";
}

inspectAppt(1);
echo "------------------\n";
inspectAppt(156);
