<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\MessageDeletion;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    /** GET /api/messages/users */
    public function users(Request $request): JsonResponse
    {
        $me    = $request->user();
        $users = User::where('id', '!=', $me->id)
            ->select('id', 'name', 'role')
            ->orderBy('name')
            ->get();

        return response()->json(['success' => true, 'data' => $users]);
    }

    /** GET /api/messages/conversations */
    public function conversations(Request $request): JsonResponse
    {
        $me = $request->user();

        $partnerIds = Message::where(function ($q) use ($me) {
                $q->where('sender_id', $me->id)->orWhere('receiver_id', $me->id);
            })
            ->notHiddenFor($me->id)
            ->selectRaw('CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as partner_id', [$me->id])
            ->distinct()
            ->pluck('partner_id');

        $conversations = [];

        foreach ($partnerIds as $partnerId) {
            $partner = User::find($partnerId, ['id', 'name', 'role']);
            if (!$partner) continue;

            $lastMessage = Message::between($me->id, $partnerId)
                ->withTrashed()
                ->with('deletions')
                ->orderByDesc('created_at')
                ->first();

            $unread = Message::where('sender_id', $partnerId)
                ->where('receiver_id', $me->id)
                ->whereNull('read_at')
                ->notHiddenFor($me->id)
                ->count();

            $conversations[] = [
                'partner'      => $partner,
                'last_message' => $lastMessage ? [
                    'body'       => $lastMessage->isDeletedFor($me->id) ? null : $lastMessage->body,
                    'created_at' => $lastMessage->created_at,
                    'is_mine'    => $lastMessage->sender_id === $me->id,
                    'is_deleted' => $lastMessage->isDeletedFor($me->id),
                ] : null,
                'unread_count' => $unread,
            ];
        }

        usort($conversations, function ($a, $b) {
            $ta = $a['last_message']['created_at'] ?? null;
            $tb = $b['last_message']['created_at'] ?? null;
            if (!$ta && !$tb) return 0;
            if (!$ta) return 1;
            if (!$tb) return -1;
            return $tb <=> $ta;
        });

        return response()->json(['success' => true, 'data' => $conversations]);
    }

    /** GET /api/messages/{userId} */
    public function index(Request $request, int $userId): JsonResponse
    {
        $me = $request->user();

        $messages = Message::between($me->id, $userId)
            ->withTrashed()
            ->with('deletions')
            ->orderBy('created_at')
            ->get()
            ->map(function ($m) use ($me) {
                $deleted = $m->isDeletedFor($me->id);
                return [
                    'id'          => $m->id,
                    'body'        => $deleted ? null : $m->body,
                    'sender_id'   => $m->sender_id,
                    'receiver_id' => $m->receiver_id,
                    'is_mine'     => $m->sender_id === $me->id,
                    'read_at'     => $m->read_at,
                    'created_at'  => $m->created_at,
                    'is_deleted'  => $deleted,
                ];
            });

        Message::where('sender_id', $userId)
            ->where('receiver_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true, 'data' => $messages]);
    }

    /** POST /api/messages/{userId} */
    public function store(Request $request, int $userId): JsonResponse
    {
        $me = $request->user();

        if ($userId === $me->id) {
            return response()->json(['success' => false, 'message' => 'Impossible de vous envoyer un message à vous-même.'], 422);
        }

        if (!User::find($userId)) {
            return response()->json(['success' => false, 'message' => 'Utilisateur introuvable.'], 404);
        }

        $request->validate(['body' => 'required|string|max:2000']);

        $message = Message::create([
            'sender_id'   => $me->id,
            'receiver_id' => $userId,
            'body'        => $request->body,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'id'          => $message->id,
                'body'        => $message->body,
                'sender_id'   => $message->sender_id,
                'receiver_id' => $message->receiver_id,
                'is_mine'     => true,
                'read_at'     => null,
                'created_at'  => $message->created_at,
            ],
        ], 201);
    }

    /**
     * DELETE /api/messages/{messageId}
     * scope=everyone → sender-only, removes the message for both participants.
     * scope=me       → either participant, hides the message for themselves only.
     */
    public function destroy(Request $request, int $messageId): JsonResponse
    {
        $me = $request->user();

        $request->validate(['scope' => 'nullable|string|in:me,everyone']);
        $scope = $request->input('scope', 'me');

        $message = Message::where('id', $messageId)
            ->where(function ($q) use ($me) {
                $q->where('sender_id', $me->id)->orWhere('receiver_id', $me->id);
            })
            ->first();

        if (!$message) {
            return response()->json(['success' => false, 'message' => 'Message introuvable ou non autorisé.'], 404);
        }

        if ($scope === 'everyone') {
            if ($message->sender_id !== $me->id) {
                return response()->json(['success' => false, 'message' => 'Seul l\'expéditeur peut supprimer pour tout le monde.'], 403);
            }
            $message->delete();
        } else {
            MessageDeletion::firstOrCreate([
                'message_id' => $message->id,
                'user_id'    => $me->id,
            ]);
        }

        return response()->json(['success' => true]);
    }

    /**
     * DELETE /api/messages/conversation/{partnerId}
     * Hides the whole conversation history for the current user only, like
     * "delete chat" — the other participant's copy is left untouched.
     */
    public function destroyConversation(Request $request, int $partnerId): JsonResponse
    {
        $me = $request->user();

        $rows = Message::between($me->id, $partnerId)
            ->withTrashed()
            ->pluck('id')
            ->map(fn ($id) => ['message_id' => $id, 'user_id' => $me->id, 'created_at' => now()])
            ->all();

        if ($rows) {
            MessageDeletion::insertOrIgnore($rows);
        }

        return response()->json(['success' => true]);
    }

    /** PATCH /api/messages/{userId}/read */
    public function markRead(Request $request, int $userId): JsonResponse
    {
        $me = $request->user();

        Message::where('sender_id', $userId)
            ->where('receiver_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /** GET /api/messages/unread-count */
    public function unreadCount(Request $request): JsonResponse
    {
        $me    = $request->user();
        $count = Message::where('receiver_id', $me->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['success' => true, 'data' => ['count' => $count]]);
    }
}
