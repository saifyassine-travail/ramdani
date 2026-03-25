<?php

namespace App\Http\Controllers;

use App\Models\BackupLog;
use App\Services\BackupService;
use App\Services\GoogleDriveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
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
        // Pass user_id via OAuth "state" parameter — survives the redirect reliably
        $state = base64_encode(json_encode([
            'user_id' => $request->query('user_id'),
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
        try {
            // Decode state to get the user_id we passed in
            $state  = json_decode(base64_decode($request->query('state', '')), true);
            $userId = $state['user_id'] ?? null;

            $googleUser = Socialite::driver('google')->stateless()->user();

            if (!$userId) {
                // Fallback: try to find user by google_id (re-linking)
                $user = \App\Models\User::where('google_id', $googleUser->getId())->first();
                if (!$user) {
                    return redirect(env('FRONTEND_URL', 'http://localhost:3000') . '/settings?error=no_user_found');
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

            return redirect(env('FRONTEND_URL', 'http://localhost:3000') . '/settings?google_linked=success');
        } catch (\Exception $e) {
            return redirect(env('FRONTEND_URL', 'http://localhost:3000') . '/settings?error=' . urlencode($e->getMessage()));
        }
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
