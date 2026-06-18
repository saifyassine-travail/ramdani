<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            $table->string('type')->nullable()->after('Code_ATCv');
            $table->string('type_category')->nullable()->after('type');
            $table->string('laboratory')->nullable()->after('type_category');
            $table->string('statut')->nullable()->after('laboratory');
            $table->decimal('prix_hospitalier', 8, 2)->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            $table->dropColumn(['type', 'type_category', 'laboratory', 'statut', 'prix_hospitalier']);
        });
    }
};
