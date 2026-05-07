<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$all_bla = \DB::table('case_descriptions')
    ->get()
    ->filter(function($row) {
        return stripos($row->case_description, 'bla') !== false || stripos($row->notes, 'bla') !== false;
    });

$results = [];
foreach ($all_bla as $row) {
    $results[] = (array)$row;
}

file_put_contents('bla_search.json', json_encode($results, JSON_PRETTY_PRINT));
echo "Found " . count($results) . " rows. Results in bla_search.json\n";
