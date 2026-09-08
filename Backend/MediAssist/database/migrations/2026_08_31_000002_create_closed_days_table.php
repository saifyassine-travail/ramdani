<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jours de fermeture du cabinet (congés, jours fériés, absences).
 *
 * Une ligne = un jour où le médecin ne consulte pas. Le personnel ne peut plus
 * y programmer de rendez-vous ; les rendez-vous déjà pris ce jour-là ne sont
 * jamais supprimés automatiquement — c'est au cabinet d'appeler les patients
 * pour convenir d'une autre date.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('closed_days', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->string('reason', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('closed_days');
    }
};
