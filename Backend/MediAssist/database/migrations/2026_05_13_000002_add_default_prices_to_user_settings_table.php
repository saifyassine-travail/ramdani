<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->integer('default_consultation_price')->default(250)->after('show_ddr');
            $table->integer('default_control_price')->default(0)->after('default_consultation_price');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn(['default_consultation_price', 'default_control_price']);
        });
    }
};
