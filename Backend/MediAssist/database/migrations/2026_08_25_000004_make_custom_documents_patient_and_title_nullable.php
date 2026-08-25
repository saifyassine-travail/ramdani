<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Letters are no longer required to be attached to a patient (they can
     * now be composed as free-standing documents from the navbar), and the
     * title is derived server-side from the content when not supplied, so
     * both columns need to accept null. The FK constraint has to be dropped
     * and re-added because Postgres won't let a column keep its existing
     * foreign key while being altered to nullable via a plain ->change().
     */
    public function up(): void
    {
        Schema::table('custom_documents', function (Blueprint $table) {
            $table->dropForeign(['ID_patient']);
        });

        Schema::table('custom_documents', function (Blueprint $table) {
            $table->unsignedBigInteger('ID_patient')->nullable()->change();
            $table->string('title')->nullable()->change();
        });

        Schema::table('custom_documents', function (Blueprint $table) {
            $table->foreign('ID_patient')->references('ID_patient')->on('patients')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_documents', function (Blueprint $table) {
            $table->dropForeign(['ID_patient']);
        });

        Schema::table('custom_documents', function (Blueprint $table) {
            $table->unsignedBigInteger('ID_patient')->nullable(false)->change();
            $table->string('title')->nullable(false)->change();
        });

        Schema::table('custom_documents', function (Blueprint $table) {
            $table->foreign('ID_patient')->references('ID_patient')->on('patients')->onDelete('cascade');
        });
    }
};
