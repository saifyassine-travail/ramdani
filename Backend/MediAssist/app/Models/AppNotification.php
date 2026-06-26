<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppNotification extends Model
{
    protected $table = 'app_notifications';

    protected $fillable = [
        'type', 'level', 'title', 'message', 'link', 'data', 'read_at',
    ];

    protected $casts = [
        'data'    => 'array',
        'read_at' => 'datetime',
    ];

    /**
     * Create a clinic-wide notification for the header bell. Never throws — a
     * failed notification must not break the operation that triggered it.
     */
    public static function record(
        string $type,
        string $title,
        ?string $message = null,
        string $level = 'info',
        ?string $link = null,
        ?array $data = null,
    ): ?self {
        try {
            return self::create(compact('type', 'title', 'message', 'level', 'link', 'data'));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('AppNotification::record failed: ' . $e->getMessage());
            return null;
        }
    }
}
