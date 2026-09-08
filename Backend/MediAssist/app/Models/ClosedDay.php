<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Jour de fermeture du cabinet. `date` est unique : un jour est fermé ou non.
 */
class ClosedDay extends Model
{
    protected $table = 'closed_days';

    protected $fillable = ['date', 'reason', 'created_by'];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
