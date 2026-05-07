<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$appts = \DB::table('appointments')->where('ID_patient', 5)->orderBy('appointment_date', 'asc')->get();
foreach ($appts as $a) {
    echo "ID_RV: {$a->ID_RV}, date: {$a->appointment_date}\n";
}
