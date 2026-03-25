<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Nightly automated backup for all users with Google linked (runs at 2:00 AM)
Schedule::command('backup:user --all')->dailyAt('02:00')->withoutOverlapping();
