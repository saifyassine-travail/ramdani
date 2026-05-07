<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

try {
    $cases = \DB::table('case_descriptions')->orderBy('id', 'desc')->limit(3)->get();
    echo "CASE DESCRIPTIONS:\n";
    foreach ($cases as $c) {
        echo "ID_RV: {$c->ID_RV} - Desc: {$c->case_description}\n";
    }

    $appts = \DB::table('appointments')->orderBy('ID_RV', 'desc')->limit(3)->get();
    echo "\nAPPOINTMENTS:\n";
    foreach ($appts as $a) {
        echo "ID_RV: {$a->ID_RV} - Notes: " . ($a->notes ?? 'NULL') . " - Desc: " . ($a->description ?? 'NULL') . " - Diag: " . ($a->Diagnostic ?? 'NULL') . "\n";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
