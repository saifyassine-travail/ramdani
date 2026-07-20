<?php
namespace App\Models;

use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    use HasFactory;

    protected $table = 'certificats_medicaux';
    protected $primaryKey = 'ID_CM';

    protected $fillable = ['start_date', 'end_date', 'content', 'ID_patient'];

    public function patient()
    {
        return $this->belongsTo(Patient::class, 'ID_patient');
    }
}


?>
