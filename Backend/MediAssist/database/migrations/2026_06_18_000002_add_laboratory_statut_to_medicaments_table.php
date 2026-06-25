<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            if (!Schema::hasColumn('medicaments', 'laboratory')) {
                $table->string('laboratory')->nullable()->after('type_category');
            }
            if (!Schema::hasColumn('medicaments', 'statut')) {
                $table->string('statut')->nullable()->after('laboratory');
            }
        });
    }

    public function down(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            $table->dropColumn(['laboratory', 'statut']);
        });
    }
};
