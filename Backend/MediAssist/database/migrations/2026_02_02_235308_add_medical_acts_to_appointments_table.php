<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('appointments', 'medical_acts')) {
            Schema::table('appointments', function (Blueprint $table) {
                $table->text('medical_acts')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('appointments', 'medical_acts')) {
            Schema::table('appointments', function (Blueprint $table) {
                $table->dropColumn('medical_acts');
            });
        }
    }
};
