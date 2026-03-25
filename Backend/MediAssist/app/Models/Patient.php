<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Appointment;

class Patient extends Model
{
    use HasFactory;

    protected $table = 'patients';
    protected $primaryKey = 'ID_patient';

    protected $fillable = [
        'first_name',
        'last_name',
        'birth_day',
        'gender',
        'CIN',
        'phone_num',
        'email',
        'mutuelle',
        'allergies',
        'chronic_conditions',
        'notes',
        'archived',
        'DDR',
        'blood_type',
    ];

    public function Appointment(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Appointment::class, 'ID_patient');
    }

    public function certificats(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Certificate::class, 'ID_patient');
    }
    public function lastAppointment()
{
    return $this->hasOne(Appointment::class, 'ID_patient', 'ID_patient')
        ->where('appointment_date', '<=', now())
        ->latest('appointment_date');
}

public function nextAppointment()
{
    return $this->hasOne(Appointment::class, 'ID_patient', 'ID_patient')
        ->where('appointment_date', '>', now())
        ->oldest('appointment_date');
}

public function documents()
{
    return $this->hasMany(PatientDocument::class, 'ID_patient', 'ID_patient');
}
}
