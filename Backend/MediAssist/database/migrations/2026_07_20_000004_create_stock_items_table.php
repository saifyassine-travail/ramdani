<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_items', function (Blueprint $table) {
            $table->id('ID_Stock');
            $table->string('name');
            $table->integer('quantity')->default(0);
            $table->integer('threshold')->nullable();
            $table->string('unit')->nullable();
            $table->string('supplier')->nullable();
            $table->decimal('purchase_price', 8, 2)->nullable();
            $table->date('expiration_date')->nullable();
            $table->boolean('archived')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_items');
    }
};
