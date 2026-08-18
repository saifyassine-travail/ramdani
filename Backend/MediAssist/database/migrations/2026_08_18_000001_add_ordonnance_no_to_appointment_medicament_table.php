<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Allow several ordonnances (prescriptions) per appointment: the same medicament
 * can appear in different ordonnances of the same RDV. The pivot gains an
 * ordonnance_no and the primary key includes it. Idempotent so it is safe to run
 * on environments where the column was already added manually.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('appointment_medicament', 'ordonnance_no')) {
            Schema::table('appointment_medicament', function ($table) {
                $table->integer('ordonnance_no')->default(1);
            });
        }

        // Rebuild the composite primary key to include ordonnance_no (Postgres).
        DB::statement('ALTER TABLE appointment_medicament DROP CONSTRAINT IF EXISTS appointment_medicament_pkey');
        DB::statement('ALTER TABLE appointment_medicament ADD CONSTRAINT appointment_medicament_pkey PRIMARY KEY ("ID_RV", "ID_Medicament", ordonnance_no)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE appointment_medicament DROP CONSTRAINT IF EXISTS appointment_medicament_pkey');
        DB::statement('ALTER TABLE appointment_medicament ADD CONSTRAINT appointment_medicament_pkey PRIMARY KEY ("ID_RV", "ID_Medicament")');

        if (Schema::hasColumn('appointment_medicament', 'ordonnance_no')) {
            Schema::table('appointment_medicament', function ($table) {
                $table->dropColumn('ordonnance_no');
            });
        }
    }
};
