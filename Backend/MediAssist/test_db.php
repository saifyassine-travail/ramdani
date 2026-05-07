<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$settings = DB::table('user_settings')->first();
echo "CUSTOM MEASURES DB DUMP:\n";
echo $settings->custom_measures;
echo "\n";
