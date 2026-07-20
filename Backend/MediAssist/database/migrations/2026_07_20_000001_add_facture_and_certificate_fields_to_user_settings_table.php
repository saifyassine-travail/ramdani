<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('user_settings', 'facture_background')) {
                $table->string('facture_background')->nullable();
            }
            if (!Schema::hasColumn('user_settings', 'facture_layout')) {
                $table->json('facture_layout')->nullable();
            }
            if (!Schema::hasColumn('user_settings', 'certificate_template')) {
                $table->text('certificate_template')->nullable();
            }
            if (!Schema::hasColumn('user_settings', 'practice_city')) {
                $table->string('practice_city')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn([
                'facture_background',
                'facture_layout',
                'certificate_template',
                'practice_city',
            ]);
        });
    }
};
