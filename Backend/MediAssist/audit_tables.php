<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$tables = DB::select('SHOW TABLES');
echo "Toutes les tables:\n";
foreach ($tables as $t) {
    foreach ($t as $v) {
        if (str_contains($v, 'med') || str_contains($v, 'anal')) {
            echo "  * " . $v . "\n";
            $cols = Schema::getColumnListing($v);
            echo "    Cols: [" . implode(', ', $cols) . "]\n";
        } else {
            echo "    - " . $v . "\n";
        }
    }
}
