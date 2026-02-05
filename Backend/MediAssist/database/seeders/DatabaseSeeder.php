<?php

namespace Database\Seeders;

use App\Models\Analysis;
use Illuminate\Database\Seeder;
use App\Models\Patient;
use App\Models\Appointment;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {

        Analysis::factory()->count(50)->create();
    }
}
