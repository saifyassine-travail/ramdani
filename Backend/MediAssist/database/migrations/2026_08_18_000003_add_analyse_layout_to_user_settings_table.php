<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Dedicated layout/background for the analyses request document (like the
 * ordonnance), so the analyses printout can be positioned independently.
 * Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function ($table) {
            if (!Schema::hasColumn('user_settings', 'analyse_background')) {
                $table->string('analyse_background')->nullable();
            }
            if (!Schema::hasColumn('user_settings', 'analyse_layout')) {
                $table->json('analyse_layout')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function ($table) {
            if (Schema::hasColumn('user_settings', 'analyse_background')) {
                $table->dropColumn('analyse_background');
            }
            if (Schema::hasColumn('user_settings', 'analyse_layout')) {
                $table->dropColumn('analyse_layout');
            }
        });
    }
};
