<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Records who did what. Resolves the acting user from the Sanctum bearer token —
 * which works even on routes that aren't behind the auth:sanctum middleware,
 * because the frontend attaches the token to every request.
 */
class ActivityLogger
{
    /**
     * Write one audit entry. Never throws: auditing must not break the action
     * being audited.
     */
    public static function log(string $action, string $description, $subject = null, ?User $user = null): ?ActivityLog
    {
        try {
            $user ??= self::actingUser();

            return ActivityLog::create([
                'user_id'      => $user?->id,
                'user_name'    => $user?->name,
                'action'       => $action,
                'description'  => $description,
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id'   => $subject ? (string) ($subject->getKey() ?? null) : null,
                'ip_address'   => request()?->ip(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('ActivityLogger::log failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * The authenticated user behind the current request, resolved via the Sanctum
     * guard so it works on both protected and unprotected routes.
     */
    public static function actingUser(): ?User
    {
        try {
            return auth('sanctum')->user() ?? auth()->user();
        } catch (\Throwable $e) {
            return null;
        }
    }
}
