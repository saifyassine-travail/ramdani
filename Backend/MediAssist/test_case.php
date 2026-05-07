<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$cases = \DB::table('case_descriptions')->get();
foreach ($cases as $c) {
    echo "Appt ID: {$c->appointment_id} - text: '{$c->case_description}'\n";
}
