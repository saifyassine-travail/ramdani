<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$content = file_get_contents(storage_path('logs/laravel.log'));

// Just dump the last 3000 chars
echo substr($content, -3000);
