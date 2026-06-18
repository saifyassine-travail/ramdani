<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // Minors (under 18) have no CIN of their own.
            $table->string('CIN')->nullable()->change();
            // For minors, store the CIN of the parent/guardian instead.
            $table->string('guardian_cin')->nullable()->after('CIN');
            // Whose CIN it is: 'father' | 'mother'.
            $table->string('guardian_relation')->nullable()->after('guardian_cin');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn(['guardian_cin', 'guardian_relation']);
            // Note: reverting CIN to NOT NULL requires every row to have a CIN.
            $table->string('CIN')->nullable(false)->change();
        });
    }
};
