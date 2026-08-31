<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links the practice catalogue to the national reference base (schema med_ref,
 * built from medicament.ma + the CNSS and CNOPS reimbursement lists), and adds
 * the preference that controls whether the dosage is displayed apart from the
 * brand name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            // med_ref.medicament.id — nullable: a doctor can add a product that
            // is not in the national base.
            $table->unsignedInteger('ref_id')->nullable()->after('ID_Medicament');
            $table->string('brand', 255)->nullable()->after('name');
            $table->index('ref_id');
        });

        Schema::table('user_settings', function (Blueprint $table) {
            $table->boolean('separate_dosage')->default(false)->after('show_ddr');
            $table->boolean('show_reimbursement')->default(true)->after('separate_dosage');
        });
    }

    public function down(): void
    {
        Schema::table('medicaments', function (Blueprint $table) {
            $table->dropIndex(['ref_id']);
            $table->dropColumn(['ref_id', 'brand']);
        });
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn(['separate_dosage', 'show_reimbursement']);
        });
    }
};
