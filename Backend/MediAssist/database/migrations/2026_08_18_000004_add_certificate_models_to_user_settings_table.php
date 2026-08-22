<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Multiple certificate models (named templates). Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function ($table) {
            if (!Schema::hasColumn('user_settings', 'certificate_models')) {
                $table->json('certificate_models')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function ($table) {
            if (Schema::hasColumn('user_settings', 'certificate_models')) {
                $table->dropColumn('certificate_models');
            }
        });
    }
};
