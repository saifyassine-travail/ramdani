<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Medicament extends Model
{
    use HasFactory;

    protected $table = 'medicaments';
    protected $primaryKey = 'ID_Medicament';

    protected $fillable = [
        'name', 'price', 'prix_hospitalier', 'dosage', 'composition',
        'Classe_thérapeutique', 'Code_ATCv',
        'type', 'type_category', 'laboratory', 'statut',
        'archived', 'is_favorite',
    ];

    public function appointments()
    {
        return $this->belongsToMany(Appointment::class, 'appointment_medicament', 'ID_Medicament', 'ID_RV')
            ->withPivot('dosage', 'frequence', 'duree')
            ->withTimestamps();
    }

}
