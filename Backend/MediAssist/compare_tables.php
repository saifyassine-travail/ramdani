<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function check($t) {
    echo "$t: " . (Schema::hasTable($t) ? "YES" : "NO");
    if (Schema::hasTable($t)) {
        echo " (Count: " . DB::table($t)->count() . ")";
    }
    echo "\n";
}

check('appointment_medicament');
check('medicament_appointment');
check('appointment_analyse');
check('analysis_appointment');
