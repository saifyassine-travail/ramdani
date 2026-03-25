<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CaseDescription extends Model
{
    use HasFactory;

    protected $table = 'case_descriptions';
    protected $primaryKey = 'id';

    protected $fillable = [
        'case_description',
        'weight',
        'pulse',
        'temperature',
        'blood_pressure',
        'tall',
        'spo2',
        'notes',
        'custom_measures_values',
        'ID_RV',
    ];

    public function appointment()
    {
        return $this->belongsTo(Appointment::class, 'ID_RV', 'ID_RV');
    }
}
