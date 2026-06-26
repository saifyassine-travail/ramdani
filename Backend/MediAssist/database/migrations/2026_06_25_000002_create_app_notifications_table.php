<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clinic-wide notifications shown in the header bell. Named app_notifications
        // to avoid clashing with Laravel's built-in `notifications` table/trait.
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type')->index();          // backup | credit | account | appointment | ...
            $table->string('level')->default('info');  // info | success | warning | error
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('link')->nullable();         // optional in-app route to open
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index('read_at');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_notifications');
    }
};
