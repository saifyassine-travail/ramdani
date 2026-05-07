<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "DB: " . DB::connection()->getDatabaseName() . "\n";
echo "DB_DATABASE env: " . env('DB_DATABASE') . "\n";

$tables = DB::select('SHOW TABLES');
echo "Tables list:\n";
foreach ($tables as $t) {
    foreach ($t as $v) echo "  - " . $v . "\n";
}

echo "medicament_appointment exists (Schema): " . (Schema::hasTable('medicament_appointment') ? "YES" : "NO") . "\n";
echo "medicament_appointment count (DB): " . DB::table('medicament_appointment')->count() . "\n";
