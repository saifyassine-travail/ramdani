<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            // Who acted. user_id is kept loose (no FK) so a log survives if the
            // user is later deleted; user_name snapshots the name at the time.
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name')->nullable();
            // What happened, e.g. "patient.created", "auth.login".
            $table->string('action')->index();
            $table->text('description')->nullable();
            // Optional target of the action (model class short-name + id).
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
