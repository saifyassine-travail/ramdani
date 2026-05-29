<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            $table->boolean('is_favorite')->default(false)->after('archived');
        });

        Schema::table('analyses', function (Blueprint $table) {
            $table->boolean('is_favorite')->default(false)->after('archived');
        });
    }

    public function down(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            $table->dropColumn('is_favorite');
        });

        Schema::table('analyses', function (Blueprint $table) {
            $table->dropColumn('is_favorite');
        });
    }
};
