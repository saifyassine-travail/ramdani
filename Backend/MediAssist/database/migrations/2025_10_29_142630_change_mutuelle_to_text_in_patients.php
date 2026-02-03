<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        try {
            $driver = DB::connection()->getDriverName();
            
            if ($driver === 'mysql') {
                // MySQL syntax - Modify to TEXT
                DB::statement("ALTER TABLE patients MODIFY COLUMN mutuelle TEXT NULL");
            } elseif ($driver === 'pgsql') {
                // PostgreSQL syntax
                DB::statement("ALTER TABLE patients ALTER COLUMN mutuelle TYPE TEXT");
                DB::statement("ALTER TABLE patients ALTER COLUMN mutuelle DROP NOT NULL");
                try {
                    DB::statement("ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_mutuelle_check");
                } catch (\Exception $e) {
                }
            } else {
                 Schema::table('patients', function (Blueprint $table) {
                    $table->string('mutuelle')->nullable()->change();
                 });
            }
        } catch (\Exception $e) {
             // If this migration fails, it blocks everything.
             // We can try to catch and ignore if it's already done?
             // But for now, let it throw so we know.
             throw $e;
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // Revert logic is risky if data has changed, skipping for now to avoid data loss on rollback
        });
    }
};
