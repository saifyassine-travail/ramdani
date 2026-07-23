<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MessageDeletion extends Model
{
    public $timestamps  = false;
    const CREATED_AT    = 'created_at';
    const UPDATED_AT    = null;

    protected $fillable = ['message_id', 'user_id'];
}
