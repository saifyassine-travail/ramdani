<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$id = 2;
$meds = DB::table('medicament_appointment')->where('ID_RV', $id)->get();
$anals = DB::table('analysis_appointment')->where('ID_RV', $id)->get();

echo "RV $id Meds: " . $meds->toJson() . "\n";
echo "RV $id Anals: " . $anals->toJson() . "\n";
