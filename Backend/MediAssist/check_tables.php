<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Schema;

echo "medicament_appointment: " . (Schema::hasTable('medicament_appointment') ? "YES" : "NO") . "\n";
echo "appointment_medicament: " . (Schema::hasTable('appointment_medicament') ? "YES" : "NO") . "\n";
echo "analysis_appointment: " . (Schema::hasTable('analysis_appointment') ? "YES" : "NO") . "\n";
echo "appointment_analyse: " . (Schema::hasTable('appointment_analyse') ? "YES" : "NO") . "\n";
