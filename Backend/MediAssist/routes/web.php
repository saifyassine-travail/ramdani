<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\BackupController;

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\PatientController;

Route::prefix('appointments')->group(function () {
    Route::get('/{date?}', [AppointmentController::class, 'index']);
    Route::get('/monthly-counts/{yearMonth}', [AppointmentController::class, 'monthlyCounts']);
    Route::post('/update-status', [AppointmentController::class, 'updateStatus']);
    Route::post('/toggle-mutuelle', [AppointmentController::class, 'toggleMutuelle']);
    Route::put('/{id}/details', [AppointmentController::class, 'editAppointmentDetails']);
    Route::get('/{id}/last-info', [AppointmentController::class, 'getLastAppointmentInfo']);
    Route::post('/update-price', [AppointmentController::class, 'updatePrice']);
    Route::get('/{id}/ordonnance', [AppointmentController::class, 'generateOrdonnance']);
    Route::get('/{id}/analysis-pdf', [AppointmentController::class, 'generateAnalysis']);
    Route::get('/{id}/edit-data', [AppointmentController::class, 'showEditData']);
    Route::get('/search-medicaments', [AppointmentController::class, 'searchMedicaments']);
    Route::get('/search-analyses', [AppointmentController::class, 'searchAnalyses']);
    Route::post('/', [AppointmentController::class, 'store']);
    Route::post('/v1', [AppointmentController::class, 'storeV1']);
    Route::post('/{id}/add-control', [AppointmentController::class, 'addControl']);
});
Route::get('/patients/search', [AppointmentController::class, 'search']);

// Google OAuth routes for Drive linking
Route::get('/auth/google', [BackupController::class, 'redirectToGoogle'])->name('auth.google');
Route::get('/auth/google/callback', [BackupController::class, 'handleGoogleCallback'])->name('auth.google.callback');