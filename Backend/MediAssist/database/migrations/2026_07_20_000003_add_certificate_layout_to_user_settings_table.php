<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('user_settings', 'certificate_background')) {
                $table->string('certificate_background')->nullable();
            }
            if (!Schema::hasColumn('user_settings', 'certificate_layout')) {
                $table->json('certificate_layout')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn(['certificate_background', 'certificate_layout']);
        });
    }
};
