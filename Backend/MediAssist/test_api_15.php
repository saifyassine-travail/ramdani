<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$request = Request::create('/api/appointments/15/last-info', 'GET');
$response = app()->handle($request);

$data = json_decode($response->getContent(), true);
echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
