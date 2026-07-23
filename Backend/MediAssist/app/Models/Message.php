<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use SoftDeletes;

    protected $fillable = ['sender_id', 'receiver_id', 'body', 'read_at'];

    protected $casts = [
        'read_at'    => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function deletions(): HasMany
    {
        return $this->hasMany(MessageDeletion::class);
    }

    /** Messages exchanged between two users (in either direction). */
    public function scopeBetween(Builder $query, int $userA, int $userB): Builder
    {
        return $query->where(function ($q) use ($userA, $userB) {
            $q->where('sender_id', $userA)->where('receiver_id', $userB);
        })->orWhere(function ($q) use ($userA, $userB) {
            $q->where('sender_id', $userB)->where('receiver_id', $userA);
        });
    }

    /** Exclude messages the given user has chosen to delete "for themselves only". */
    public function scopeNotHiddenFor(Builder $query, int $userId): Builder
    {
        return $query->whereDoesntHave('deletions', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        });
    }

    /** True if this message should render as "deleted" for the given viewer. */
    public function isDeletedFor(int $userId): bool
    {
        return $this->trashed() || $this->deletions->contains('user_id', $userId);
    }
}
