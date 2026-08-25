<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\MedicamentController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\MedecinController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CertificateController;
use App\Http\Controllers\CustomDocumentController;
use App\Http\Controllers\StatisticsController;
use App\Http\Controllers\ResearchCaseController;




Route::middleware('api')->group(function () {

    // APPOINTMENTS
    Route::prefix('appointments')->group(function () {
        Route::get('/{date?}', [AppointmentController::class, 'index']);
        Route::get('/monthly-counts/{yearMonth}', [AppointmentController::class, 'monthlyCounts']);
        Route::post('/update-status', [AppointmentController::class, 'updateStatus']);
        Route::post('/toggle-mutuelle', [AppointmentController::class, 'toggleMutuelle']);
        Route::post('/toggle-free-consultation', [AppointmentController::class, 'toggleFreeConsultation']);
        Route::put('/{id}/details', [AppointmentController::class, 'editAppointmentDetails']);
        Route::get('/{id}/last-info', [AppointmentController::class, 'getLastAppointmentInfo']);
        Route::post('/update-price', [AppointmentController::class, 'updatePrice']);
        Route::post('/update-credit', [AppointmentController::class, 'updateCredit']);
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

// Case-description auto-suggest history (kept out of the greedy appointments/{date?} prefix)
Route::get('/case-descriptions/suggestions', [AppointmentController::class, 'caseDescriptionSuggestions']);

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
    Route::get('/{patientId}/case-history', [AppointmentController::class, 'getCaseHistoryByPatient']);
    // AI dossier summary (proxies to the internal patient-summary microservice)
    Route::post('/{id}/summary', [App\Http\Controllers\PatientSummaryController::class, 'summarize']);

    // Patient Documents
    Route::prefix('{patientId}/documents')->group(function () {
        Route::get('/', [App\Http\Controllers\PatientDocumentController::class, 'index']);
        Route::post('/', [App\Http\Controllers\PatientDocumentController::class, 'store']);
        Route::get('/{documentId}/download', [App\Http\Controllers\PatientDocumentController::class, 'download']);
        Route::delete('/{documentId}', [App\Http\Controllers\PatientDocumentController::class, 'destroy']);
    });

});

// RESEARCH CASES (de-identified clinical case library — reference data, not patients)
Route::prefix('research-cases')->group(function () {
    Route::get('/', [ResearchCaseController::class, 'index']);
    Route::get('/{id}', [ResearchCaseController::class, 'show']);
});

// CIN card OCR (proxies to the internal extraction microservice, single host for mobile clients)
Route::post('/extract-cin', [App\Http\Controllers\CinExtractionController::class, 'extract']);

// MEDICAMENTS
Route::prefix('medicaments')->controller(MedicamentController::class)->group(function () {
    Route::get('/search', 'search');          // put search FIRST
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::put('{id}', 'update');             // keep this AFTER search
    Route::patch('{id}/archive', 'archive');
    Route::patch('{id}/restore', 'restore');
    Route::patch('{id}/favorite', 'toggleFavorite');
});


// STOCK
Route::prefix('stock')->controller(StockController::class)->group(function () {
    Route::get('/search', 'search');          // put search FIRST
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::put('{id}', 'update');             // keep this AFTER search
    Route::patch('{id}/archive', 'archive');
    Route::patch('{id}/restore', 'restore');
    Route::patch('{id}/adjust-quantity', 'adjustQuantity');
});


// MESSAGES (chat between users)
Route::prefix('messages')->middleware('auth:sanctum')->group(function () {
    Route::get('/users', [MessageController::class, 'users']);
    Route::get('/conversations', [MessageController::class, 'conversations']);
    Route::get('/unread-count', [MessageController::class, 'unreadCount']);
    Route::delete('/conversation/{partnerId}', [MessageController::class, 'destroyConversation']);
    Route::get('/{userId}', [MessageController::class, 'index']);
    Route::post('/{userId}', [MessageController::class, 'store']);
    Route::delete('/{messageId}', [MessageController::class, 'destroy']);
    Route::patch('/{userId}/read', [MessageController::class, 'markRead']);
});


// ANALYSES
Route::prefix('analyses')->controller(AnalysisController::class)->group(function () {
    Route::get('/search', 'search');       // GET /api/analyses/search?term=... (before {id})
    Route::get('/', 'index');              // GET /api/analyses
    Route::post('/', 'store');             // POST /api/analyses
    Route::put('{id}', 'update');          // PUT /api/analyses/{id}
    Route::patch('{id}/archive', 'archive'); // PATCH /api/analyses/{id}/archive
    Route::patch('{id}/restore', 'restore'); // PATCH /api/analyses/{id}/restore
    Route::patch('{id}/favorite', 'toggleFavorite'); // PATCH /api/analyses/{id}/favorite
    Route::delete('{id}', 'destroy');      // DELETE /api/analyses/{id}
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
    Route::get('/statistics/appointments-detail', [StatisticsController::class, 'getAppointmentsDetail']);
});


Route::get('/setup/status', [SetupController::class, 'status']);
Route::post('/setup/create-admin', [SetupController::class, 'createAdmin']);

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

Route::prefix('custom-documents')->group(function () {
    Route::get('/', [CustomDocumentController::class, 'indexAll']);
    Route::get('/{customDocument}', [CustomDocumentController::class, 'show']);
    Route::post('/', [CustomDocumentController::class, 'store']);
    Route::put('/{customDocument}', [CustomDocumentController::class, 'update']);
    Route::delete('/{customDocument}', [CustomDocumentController::class, 'destroy']);
});

// SETTINGS
// Document-background images are served publicly (no auth): they load as <img>
// sources in prescriptions/invoices/certificates, and a browser image request can't
// carry the bearer token. The serve handlers stream a single file by name and set
// CORS headers (needed for PDF export). Uploads and settings stay authenticated.
Route::prefix('settings')->group(function () {
    Route::get('/ordonnance-background/{filename}', [App\Http\Controllers\SettingsController::class, 'serveOrdonnanceBackground']);
    Route::get('/facture-background/{filename}', [App\Http\Controllers\SettingsController::class, 'serveFactureBackground']);
    Route::get('/certificate-background/{filename}', [App\Http\Controllers\SettingsController::class, 'serveCertificateBackground']);
    Route::get('/analyse-background/{filename}', [App\Http\Controllers\SettingsController::class, 'serveAnalyseBackground']);
});
Route::prefix('settings')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [App\Http\Controllers\SettingsController::class, 'getUserSettings']);
    Route::put('/', [App\Http\Controllers\SettingsController::class, 'updateUserSettings']);
    Route::post('/upload-background', [App\Http\Controllers\SettingsController::class, 'uploadOrdonnanceBackground']);
    Route::post('/upload-facture-background', [App\Http\Controllers\SettingsController::class, 'uploadFactureBackground']);
    Route::post('/upload-certificate-background', [App\Http\Controllers\SettingsController::class, 'uploadCertificateBackground']);
    Route::post('/upload-analyse-background', [App\Http\Controllers\SettingsController::class, 'uploadAnalyseBackground']);
});

// USER MANAGEMENT (Admin only)
Route::prefix('users')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [App\Http\Controllers\SettingsController::class, 'getUsers']);
    Route::post('/', [App\Http\Controllers\SettingsController::class, 'createUser']);
    Route::put('/{id}', [App\Http\Controllers\SettingsController::class, 'updateUser']);
    Route::put('/{id}/permissions', [App\Http\Controllers\SettingsController::class, 'updateUserPermissions']);
    Route::delete('/{id}', [App\Http\Controllers\SettingsController::class, 'deleteUser']);
});

// ACTIVITY LOG & NOTIFICATIONS (admin only — enforced inside the controller)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/activity-logs', [App\Http\Controllers\ActivityController::class, 'logs']);
    Route::get('/notifications', [App\Http\Controllers\ActivityController::class, 'notifications']);
    Route::post('/notifications/read-all', [App\Http\Controllers\ActivityController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [App\Http\Controllers\ActivityController::class, 'markRead']);
});

// BACKUP & GOOGLE DRIVE SYNC
Route::prefix('backup')->middleware('auth:sanctum')->group(function () {
    Route::post('/create', [App\Http\Controllers\BackupController::class, 'createBackup']);
    Route::get('/export', [App\Http\Controllers\BackupController::class, 'exportLocal']);
    Route::get('/list', [App\Http\Controllers\BackupController::class, 'listBackups']);
    Route::post('/restore', [App\Http\Controllers\BackupController::class, 'restoreBackup']);
    Route::delete('/{driveFileId}', [App\Http\Controllers\BackupController::class, 'deleteBackup']);
    Route::get('/history', [App\Http\Controllers\BackupController::class, 'backupHistory']);
});

