<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    use HasFactory;

    protected $table = 'appointments';
    protected $fillable = ['appointment_date',        'status', 
        'mutuelle', 
        'payement',
        'credit',
        'diagnostic',
        'type',
        'consultation_started_at',
        'consultation_ended_at',
        'updated_at',
        'ID_patient',
        'medical_acts'];

    protected $casts = [
        'medical_acts' => 'array',
    ];

    protected $primaryKey = 'ID_RV';



    public function patient(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Patient::class, 'ID_patient', 'ID_patient');
    }

    public function analyses()
    {
        return $this->belongsToMany(Analysis::class, 'appointment_analyse', 'ID_RV', 'ID_Analyse')
            ->withTimestamps();
    }


    public function medicaments()
    {
        return $this->belongsToMany(Medicament::class, 'appointment_medicament', 'ID_RV', 'ID_Medicament')
            ->withPivot('dosage', 'frequence', 'duree','created_at')
            ->orderBy('pivot_created_at', 'desc')
            ->withTimestamps();
    }

    public function compteRendus()
    {
        return $this->hasMany(CompteRendu::class, 'id');
    }

    public function caseDescription()
    {
        return $this->hasOne(CaseDescription::class, 'ID_RV', 'ID_RV');
    }

    
}
