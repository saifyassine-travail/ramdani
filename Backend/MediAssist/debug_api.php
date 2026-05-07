<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\AppointmentController;
use Illuminate\Http\Request;

$id = 1;
$controller = new AppointmentController();
$response = $controller->getLastAppointmentInfo($id);

echo $response->getContent();
