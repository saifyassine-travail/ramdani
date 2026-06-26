<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Models\BackupLog;
use App\Services\BackupService;
use App\Services\DatabaseExportService;
use App\Services\GoogleDriveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Exception;

class BackupController extends Controller
{
    public function __construct(
        private readonly BackupService      $backupService,
        private readonly GoogleDriveService $driveService,
    ) {}

    // -------------------------------------------------------------------------
    // Google OAuth
    // -------------------------------------------------------------------------

    /**
     * Redirect the user to Google OAuth consent screen.
     * GET /auth/google?user_id=1
     */
    public function redirectToGoogle(Request $request): \Symfony\Component\HttpFoundation\RedirectResponse
    {
        // Pass user_id (and the frontend origin) via OAuth "state" parameter —
        // survives the redirect reliably.
        $state = base64_encode(json_encode([
            'user_id' => $request->query('user_id'),
            'origin'  => $request->query('origin'),
            'ts'      => now()->timestamp,
        ]));

        return Socialite::driver('google')
            ->scopes(['https://www.googleapis.com/auth/drive.file'])
            ->with([
                'access_type' => 'offline',
                'prompt'      => 'consent',
                'state'       => $state,
            ])
            ->redirect();
    }

    /**
     * Handle Google OAuth callback, save tokens to user.
     * GET /auth/google/callback
     */
    public function handleGoogleCallback(Request $request): \Illuminate\Http\RedirectResponse
    {
        // Decode state to get the user_id (and frontend origin) we passed in
        $state    = json_decode(base64_decode($request->query('state', '')), true);
        $userId   = $state['user_id'] ?? null;
        $frontend = $this->resolveFrontendUrl($state['origin'] ?? null);

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();

            if (!$userId) {
                // Fallback: try to find user by google_id (re-linking)
                $user = \App\Models\User::where('google_id', $googleUser->getId())->first();
                if (!$user) {
                    return redirect($frontend . '/settings?error=no_user_found');
                }
            } else {
                $user = \App\Models\User::findOrFail($userId);
            }

            $user->update([
                'google_id'               => $googleUser->getId(),
                'google_access_token'     => $googleUser->token,
                'google_refresh_token'    => $googleUser->refreshToken ?? $user->google_refresh_token,
                'google_token_expires_at' => now()->addSeconds($googleUser->expiresIn ?? 3600),
            ]);

            return redirect($frontend . '/settings?google_linked=success');
        } catch (\Exception $e) {
            return redirect($frontend . '/settings?error=' . urlencode($e->getMessage()));
        }
    }

    /**
     * Resolve the frontend URL to return to after OAuth. Only trusts an origin
     * from a known allowlist (prevents open-redirect); otherwise falls back to
     * the configured FRONTEND_URL.
     */
    private function resolveFrontendUrl(?string $origin): string
    {
        $allowed = [
            'http://localhost:3000', 'http://127.0.0.1:3000',
            'http://localhost:3001', 'http://127.0.0.1:3001',
        ];

        if ($origin && in_array($origin, $allowed, true)) {
            return $origin;
        }

        return env('FRONTEND_URL', 'http://localhost:3000');
    }

    // -------------------------------------------------------------------------
    // Backup
    // -------------------------------------------------------------------------

    /**
     * Trigger a manual backup for the authenticated user.
     * POST /api/backup/create
     * Body: { "password": "user_password" }
     */
    public function createBackup(Request $request): JsonResponse
    {
        $request->validate(['password' => 'required|string|min:6']);

        $user = $request->user();

        if (!$user->google_access_token) {
            return response()->json([
                'success' => false,
                'message' => 'Google account not linked. Visit /auth/google?user_id=' . $user->id . ' to connect.',
            ], 422);
        }

        try {
            $result = $this->backupService->createBackup($user, $request->password);
            return response()->json($result);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * List all available backups from Google Drive.
     * GET /api/backup/list
     */
    public function listBackups(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->google_access_token) {
            return response()->json(['success' => false, 'message' => 'Google account not linked.'], 422);
        }

        try {
            $backups = $this->driveService->listBackups($user);

            // Enrich with local log data
            $logs = BackupLog::where('user_id', $user->id)
                ->whereIn('drive_file_id', array_column($backups, 'drive_file_id'))
                ->pluck('status', 'drive_file_id');

            foreach ($backups as &$backup) {
                $backup['log_status'] = $logs[$backup['drive_file_id']] ?? 'unknown';
            }

            return response()->json(['success' => true, 'backups' => $backups]);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Restore data from a Google Drive backup.
     * POST /api/backup/restore
     * Body: { "drive_file_id": "...", "password": "..." }
     */
    public function restoreBackup(Request $request): JsonResponse
    {
        $request->validate([
            'drive_file_id' => 'required|string',
            'password'      => 'required|string|min:6',
        ]);

        $user = $request->user();

        if (!$user->google_access_token) {
            return response()->json(['success' => false, 'message' => 'Google account not linked.'], 422);
        }

        try {
            $result = $this->backupService->restoreBackup(
                $user,
                $request->drive_file_id,
                $request->password
            );
            return response()->json($result);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Delete a backup from Google Drive.
     * DELETE /api/backup/{driveFileId}
     */
    public function deleteBackup(Request $request, string $driveFileId): JsonResponse
    {
        $user = $request->user();

        try {
            $this->driveService->deleteFile($user, $driveFileId);
            BackupLog::where('user_id', $user->id)->where('drive_file_id', $driveFileId)->delete();
            return response()->json(['success' => true, 'message' => 'Backup deleted.']);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Export the whole database as a single downloadable file, so the user can
     * keep a local copy. The browser supplies the save location.
     * GET /api/backup/export?format=db|csv
     *   - db  : a self-contained SQLite database (.db)
     *   - csv : a ZIP archive with one CSV per table (.zip)
     */
    public function exportLocal(Request $request, DatabaseExportService $exporter): BinaryFileResponse|JsonResponse
    {
        $format = $request->query('format', 'db');

        if (!in_array($format, ['db', 'csv'], true)) {
            return response()->json(['success' => false, 'message' => 'Invalid format. Use "db" or "csv".'], 422);
        }

        try {
            $date = now()->format('Y-m-d_His');

            if ($format === 'csv') {
                $path     = $exporter->exportCsvZip();
                $fileName = "mediassist_export_{$date}.zip";
            } else {
                $path     = $exporter->exportSqlite();
                $fileName = "mediassist_export_{$date}.db";
            }

            AppNotification::record(
                'backup',
                'Export local de la base',
                'La base a été exportée localement (' . strtoupper($format) . ').',
                'success',
            );

            return response()->download($path, $fileName)->deleteFileAfterSend(true);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Return backup history from the local log.
     * GET /api/backup/history
     */
    public function backupHistory(Request $request): JsonResponse
    {
        $logs = BackupLog::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['success' => true, 'history' => $logs]);
    }
}
