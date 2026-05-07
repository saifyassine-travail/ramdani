<?php

require __DIR__ . '/Backend/MediAssist/vendor/autoload.php';
$app = require_once __DIR__ . '/Backend/MediAssist/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\AppointmentController;
use Illuminate\Http\Request;

$controller = new AppointmentController();
$response = $controller->getLastAppointmentInfo(155);

file_put_contents('api_response.json', json_encode($response->getData(), JSON_PRETTY_PRINT));
echo "API response saved to api_response.json\n";
