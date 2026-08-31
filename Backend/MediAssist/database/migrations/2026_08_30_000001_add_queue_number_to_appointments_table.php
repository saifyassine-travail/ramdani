<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Waiting-room ticket number. Assigned when a patient leaves "Programmé" and
 * enters the flow (Salle d'attente), then follows them through preparation,
 * consultation and completion. Null while still only scheduled or cancelled.
 * Unique per day, not globally.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->unsignedInteger('queue_number')->nullable()->after('status');
            $table->index(['appointment_date', 'queue_number']);
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex(['appointment_date', 'queue_number']);
            $table->dropColumn('queue_number');
        });
    }
};
