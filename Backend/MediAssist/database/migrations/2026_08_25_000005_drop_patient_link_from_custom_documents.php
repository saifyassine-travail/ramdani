<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Letters ("custom documents") are never associated with a patient —
     * drop the column entirely rather than leave a permanently-null FK
     * lying around.
     */
    public function up(): void
    {
        Schema::table('custom_documents', function (Blueprint $table) {
            $table->dropForeign(['ID_patient']);
            $table->dropColumn('ID_patient');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_documents', function (Blueprint $table) {
            $table->unsignedBigInteger('ID_patient')->nullable();
            $table->foreign('ID_patient')->references('ID_patient')->on('patients')->onDelete('cascade');
        });
    }
};
