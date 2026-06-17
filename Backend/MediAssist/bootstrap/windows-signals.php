<?php

// On Windows the `pcntl` extension is unavailable, so the SIG* constants that
// Laravel Octane references for graceful shutdown are undefined. Define them so
// `octane:start` can run. (No-op on non-Windows where pcntl provides them.)
if (PHP_OS_FAMILY === 'Windows') {
    foreach (['SIGINT' => 2, 'SIGTERM' => 15, 'SIGHUP' => 1, 'SIGQUIT' => 3, 'SIGUSR1' => 10, 'SIGUSR2' => 12] as $name => $value) {
        if (!defined($name)) {
            define($name, $value);
        }
    }
}
