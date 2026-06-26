<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    /**
     * Paginated audit log (admin only). Supports ?q=, ?action=, ?user_id=,
     * ?from=, ?to=, ?page=.
     * GET /api/activity-logs
     */
    public function logs(Request $request): JsonResponse
    {
        if ($deny = $this->ensureAdmin($request)) {
            return $deny;
        }

        $query = ActivityLog::query()->orderByDesc('created_at');

        if ($q = $request->query('q')) {
            $query->where(function ($sub) use ($q) {
                $sub->where('description', 'like', "%{$q}%")
                    ->orWhere('user_name', 'like', "%{$q}%")
                    ->orWhere('action', 'like', "%{$q}%");
            });
        }
        if ($action = $request->query('action')) {
            $query->where('action', 'like', $action . '%');
        }
        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($from = $request->query('from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $logs = $query->paginate(30);

        return response()->json([
            'success' => true,
            'data'    => $logs->items(),
            'meta'    => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'total'        => $logs->total(),
                'per_page'     => $logs->perPage(),
            ],
        ]);
    }

    /**
     * Recent notifications + unread count (admin only).
     * GET /api/notifications
     */
    public function notifications(Request $request): JsonResponse
    {
        if ($deny = $this->ensureAdmin($request)) {
            return $deny;
        }

        $notifications = AppNotification::orderByDesc('created_at')->limit(30)->get();
        $unread        = AppNotification::whereNull('read_at')->count();

        return response()->json([
            'success'      => true,
            'notifications' => $notifications,
            'unread_count' => $unread,
        ]);
    }

    /**
     * Mark one notification read.
     * POST /api/notifications/{id}/read
     */
    public function markRead(Request $request, $id): JsonResponse
    {
        if ($deny = $this->ensureAdmin($request)) {
            return $deny;
        }

        AppNotification::where('id', $id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * Mark every notification read.
     * POST /api/notifications/read-all
     */
    public function markAllRead(Request $request): JsonResponse
    {
        if ($deny = $this->ensureAdmin($request)) {
            return $deny;
        }

        AppNotification::whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /** Returns a 403 JsonResponse if the caller is not an admin, otherwise null. */
    private function ensureAdmin(Request $request): ?JsonResponse
    {
        $user = $request->user();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Accès réservé aux administrateurs.'], 403);
        }
        return null;
    }
}
