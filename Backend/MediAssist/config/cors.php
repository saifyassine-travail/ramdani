<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'storage/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],
	'allowed_headers' => ['*'],
	'exposed_headers' => ['*'],
	'max_age' => 86400,
	'supports_credentials' => true,

];

