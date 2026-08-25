<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomDocument extends Model
{
    use HasFactory;

    protected $table = 'custom_documents';

    protected $fillable = ['title', 'content'];
}
