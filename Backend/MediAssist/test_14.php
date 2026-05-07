<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$apptId = 14;
$appt = App\Models\Appointment::with('caseDescription')->find($apptId);

$out = "Appointment 14:\n";
$out .= "Description: " . var_export($appt->description ?? null, true) . "\n";
$out .= "Notes: " . var_export($appt->notes ?? null, true) . "\n";
$out .= "Case Desc relation exists?: " . ($appt->caseDescription ? "YES" : "NO") . "\n";
if ($appt->caseDescription) {
    $out .= "Actual case_description field: " . var_export($appt->caseDescription->case_description, true) . "\n";
}

$apiData = app()->handle(Request::create("/api/appointments/15/last-info", 'GET'))->getContent();
$out .= "\nLast info API output for 15:\n";
$out .= json_encode(json_decode($apiData), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

file_put_contents('test_14_out.txt', $out);
