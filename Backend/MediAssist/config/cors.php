<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'storage/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
    ],
	'allowed_headers' => ['*'],
	'exposed_headers' => ['*'],
	'max_age' => 86400,
	'supports_credentials' => true,

];

