<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'storage/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        // Local network addresses used in development
        'http://192.168.1.3:3000',
        'http://192.168.1.3:3001',
        // Expo web dev server (browser preview of the Mobile/ app) — native
        // Expo Go / device builds aren't subject to CORS, only this target is.
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        'http://192.168.1.159:8081',
    ],
	'allowed_headers' => ['*'],
	'exposed_headers' => ['*'],
	'max_age' => 86400,
	'supports_credentials' => true,

];

