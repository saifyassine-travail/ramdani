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
        'is_free_consultation',
        'pre_free_consultation_payment',
        'payement',
        'credit',
        'diagnostic',
        'type',
        'consultation_started_at',
        'consultation_ended_at',
        'updated_at',
        'ID_patient',
        'medical_acts',
        'notes'];

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
            ->withPivot('analyse_no', 'created_at')
            ->orderBy('pivot_analyse_no', 'asc')
            ->orderBy('pivot_created_at', 'asc')
            ->withTimestamps();
    }


    public function medicaments()
    {
        return $this->belongsToMany(Medicament::class, 'appointment_medicament', 'ID_RV', 'ID_Medicament')
            ->withPivot('dosage', 'frequence', 'duree', 'ordonnance_no', 'created_at')
            ->orderBy('pivot_ordonnance_no', 'asc')
            ->orderBy('pivot_created_at', 'asc')
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
