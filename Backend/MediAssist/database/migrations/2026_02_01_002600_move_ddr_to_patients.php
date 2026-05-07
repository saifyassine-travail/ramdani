<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('case_descriptions', function (Blueprint $table) {
            if (Schema::hasColumn('case_descriptions', 'DDR')) {
                $table->dropColumn('DDR');
            }
        });

        // Add DDR to patients only if it doesn't exist yet
        if (!Schema::hasColumn('patients', 'DDR')) {
            Schema::table('patients', function (Blueprint $table) {
                $table->date('DDR')->nullable();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('patients', 'DDR')) {
            Schema::table('patients', function (Blueprint $table) {
                $table->dropColumn('DDR');
            });
        }

        if (!Schema::hasColumn('case_descriptions', 'DDR')) {
            Schema::table('case_descriptions', function (Blueprint $table) {
                $table->date('DDR')->nullable();
            });
        }
    }
};
