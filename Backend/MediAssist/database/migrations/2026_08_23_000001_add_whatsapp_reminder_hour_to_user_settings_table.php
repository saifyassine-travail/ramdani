<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            // Hour of day (0-23, local clinic time) the day-before WhatsApp
            // reminder batch runs. Read by Backend/whatsapp-reminder-service.
            $table->unsignedTinyInteger('whatsapp_reminder_hour')->default(11)->after('reminder_timing');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn('whatsapp_reminder_hour');
        });
    }
};
