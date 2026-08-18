<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Allow several analysis requests (demandes d'analyses) per appointment: the same
 * analysis can appear in different requests of the same RDV. The pivot gains an
 * analyse_no and the primary key includes it. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('appointment_analyse', 'analyse_no')) {
            Schema::table('appointment_analyse', function ($table) {
                $table->integer('analyse_no')->default(1);
            });
        }

        DB::statement('ALTER TABLE appointment_analyse DROP CONSTRAINT IF EXISTS appointment_analyse_pkey');
        DB::statement('ALTER TABLE appointment_analyse ADD CONSTRAINT appointment_analyse_pkey PRIMARY KEY ("ID_RV", "ID_Analyse", analyse_no)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE appointment_analyse DROP CONSTRAINT IF EXISTS appointment_analyse_pkey');
        DB::statement('ALTER TABLE appointment_analyse ADD CONSTRAINT appointment_analyse_pkey PRIMARY KEY ("ID_RV", "ID_Analyse")');

        if (Schema::hasColumn('appointment_analyse', 'analyse_no')) {
            Schema::table('appointment_analyse', function ($table) {
                $table->dropColumn('analyse_no');
            });
        }
    }
};
