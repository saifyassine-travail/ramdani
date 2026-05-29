<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medicament extends Model
{
    use HasFactory;

    protected $table = 'medicaments';
    protected $primaryKey = 'ID_Medicament';

    protected $fillable = ['name', 'price', 'dosage', 'description', 'composition', 'classe_therapeutique', 'Code_ATCv', 'archived', 'is_favorite'];

    public function appointments()
    {
        return $this->belongsToMany(Appointment::class, 'appointment_medicament', 'ID_Medicament', 'ID_RV')
            ->withPivot('dosage', 'frequence', 'duree')
            ->withTimestamps();
    }

}
