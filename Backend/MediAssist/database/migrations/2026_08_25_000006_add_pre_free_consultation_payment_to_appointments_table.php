<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backs up the real `payement` while a consultation is marked free, so
     * un-checking "Consultation gratuite" can restore the exact prior
     * amount rather than recomputing it from currently-selected medical
     * acts (which may not match — payement can be set without acts, e.g.
     * via the completion modal or the patient history's inline editor).
     */
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->integer('pre_free_consultation_payment')->nullable()->after('is_free_consultation');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn('pre_free_consultation_payment');
        });
    }
};
