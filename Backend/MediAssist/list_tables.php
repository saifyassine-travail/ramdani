<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$res = Illuminate\Support\Facades\DB::select('SHOW TABLES');
$key = "Tables_in_" . env('DB_DATABASE');
foreach ($res as $r) {
    foreach ($r as $k => $v) {
        echo $v . "\n";
    }
}
