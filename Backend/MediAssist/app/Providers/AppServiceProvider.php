<?php

namespace App\Providers;

use App\Models\Analysis;
use App\Models\Appointment;
use App\Models\Medicament;
use App\Models\Patient;
use App\Models\User;
use App\Observers\ActivityObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Audit trail: log create/update/delete of the core records.
        foreach ([Patient::class, Appointment::class, Medicament::class, Analysis::class, User::class] as $model) {
            $model::observe(ActivityObserver::class);
        }
    }
}
