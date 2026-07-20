<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // Raw base64 (no "data:image/..." prefix) of the face cropped
            // from a scanned CIN card. Prefix is added at display time.
            $table->text('photo_base64')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('photo_base64');
        });
    }
};
