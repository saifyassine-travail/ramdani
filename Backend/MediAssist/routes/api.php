<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\MedicamentController;
use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\MedecinController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CertificateController;
use App\Http\Controllers\StatisticsController;




Route::middleware('api')->group(function () {

    // APPOINTMENTS
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
        Route::put('/{id}', [AppointmentController::class, 'update']);
        Route::delete('/{id}', [AppointmentController::class, 'destroy']);
        Route::post('/quick-add', [AppointmentController::class, 'quickAddAppointment']);
        Route::get('/count/{date}', [AppointmentController::class, 'countAppointmentsByDate']);
        
    });

    Route::get('/patients/search', [AppointmentController::class, 'search']);
});

// PATIENTS
Route::prefix('patients')->group(function () {
    Route::get('/', [PatientController::class, 'index']);          // GET list of patients (with pagination, supports ?archived=true)
    Route::get('/search', [PatientController::class, 'search']);   // GET /patients/search?term=...
    Route::get('/search-v2', [PatientController::class, 'searchV2']); // Optional lightweight search

    Route::post('/', [PatientController::class, 'store']);         // POST create new patient
    Route::get('/{id}', [PatientController::class, 'show']);       // GET single patient details
    Route::put('/{id}', [PatientController::class, 'update']);     // PUT full update
    Route::patch('/{id}/archive', [PatientController::class, 'archive']); // PATCH archive/unarchive
    Route::get('/{id}/last-medicaments', [AppointmentController::class, 'getLastMedicamentsByPatient']);

    // Patient Documents
    Route::prefix('{patientId}/documents')->group(function () {
        Route::get('/', [App\Http\Controllers\PatientDocumentController::class, 'index']);
        Route::post('/', [App\Http\Controllers\PatientDocumentController::class, 'store']);
        Route::get('/{documentId}/download', [App\Http\Controllers\PatientDocumentController::class, 'download']);
        Route::delete('/{documentId}', [App\Http\Controllers\PatientDocumentController::class, 'destroy']);
    });

});

// MEDICAMENTS
Route::prefix('medicaments')->controller(MedicamentController::class)->group(function () {
    Route::get('/search', 'search');          // put search FIRST
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::put('{id}', 'update');             // keep this AFTER search
    Route::patch('{id}/archive', 'archive');
    Route::patch('{id}/restore', 'restore');
});


// ANALYSES
Route::prefix('analyses')->controller(AnalysisController::class)->group(function () {
    Route::get('/', 'index');              // GET /api/analyses
    Route::post('/', 'store');             // POST /api/analyses
    Route::put('{id}', 'update');          // PUT /api/analyses/{id}
    Route::patch('{id}/archive', 'archive'); // PATCH /api/analyses/{id}/archive
    Route::patch('{id}/restore', 'restore'); // PATCH /api/analyses/{id}/restore
    Route::delete('{id}', 'destroy');      // DELETE /api/analyses/{id}
    Route::get('/search', 'search');       // GET /api/analyses/search?term=...
});

//MEDECIN DASHBOARD
Route::prefix('medecin')->group(function () {
    Route::get('/dashboard', [MedecinController::class, 'dashboard']);
    Route::post('/update-status', [MedecinController::class, 'updateStatus']);
    Route::post('/navigate-patient', [MedecinController::class, 'navigatePatient']);
    Route::post('/return-to-consultation', [MedecinController::class, 'returnToConsultation']);
    Route::get('/appointments/{date}', [MedecinController::class, 'getAppointmentsByDate']);

    // Statistics
    Route::get('/statistics', [StatisticsController::class, 'getDashboardStats']);
    Route::get('/statistics/chart-data', [StatisticsController::class, 'getChartData']);
    Route::get('/statistics/range', [StatisticsController::class, 'getAvailableRange']);
});


Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/user', [AuthController::class, 'user'])->middleware('auth:sanctum');
Route::put('/user/profile', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');



Route::prefix('certificates')->group(function () {
    Route::get('/patient/{patientId}', [CertificateController::class, 'index']);
    Route::get('/{certificate}', [CertificateController::class, 'show']);
    Route::post('/', [CertificateController::class, 'store']);
    Route::delete('/{certificate}', [CertificateController::class, 'destroy']);
});

// SETTINGS
Route::prefix('settings')->group(function () {
    Route::get('/', [App\Http\Controllers\SettingsController::class, 'getUserSettings']);
    Route::put('/', [App\Http\Controllers\SettingsController::class, 'updateUserSettings']);
});

// USER MANAGEMENT (Admin only)
Route::prefix('users')->group(function () {
    Route::get('/', [App\Http\Controllers\SettingsController::class, 'getUsers']);
    Route::post('/', [App\Http\Controllers\SettingsController::class, 'createUser']);
    Route::put('/{id}', [App\Http\Controllers\SettingsController::class, 'updateUser']);
    Route::put('/{id}/permissions', [App\Http\Controllers\SettingsController::class, 'updateUserPermissions']);
    Route::delete('/{id}', [App\Http\Controllers\SettingsController::class, 'deleteUser']);
});
