<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

Route::get('/debug-schema', function () {
    $columns = Schema::getColumnListing('appointments');
    return response()->json([
        'columns' => $columns,
        'has_medical_acts' => Schema::hasColumn('appointments', 'medical_acts')
    ]);
});
