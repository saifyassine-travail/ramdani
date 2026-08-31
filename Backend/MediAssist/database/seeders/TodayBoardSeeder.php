<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\CaseDescription;
use App\Models\Patient;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Fills TODAY's board with a realistic, full clinic day (~40 appointments)
 * spread across every column, so the "Journée en cours" dashboard can be
 * demoed / styled with real volume.
 *
 * Re-runnable: wipes today's appointments (and their case descriptions)
 * first, then recreates the day. Patients it creates are tagged
 * "[SIMULATION]" in their notes so they can be pruned later.
 * No Faker dependency (composer install runs --no-dev).
 */
class TodayBoardSeeder extends Seeder
{
    private array $maleFirstNames = [
        'Mohamed', 'Youssef', 'Ahmed', 'Hamza', 'Karim', 'Rachid', 'Omar', 'Said',
        'Younes', 'Mehdi', 'Anas', 'Bilal', 'Adil', 'Khalid', 'Nabil', 'Reda',
        'Ismail', 'Tarik', 'Amine', 'Hicham',
    ];
    private array $femaleFirstNames = [
        'Fatima', 'Khadija', 'Amina', 'Meryem', 'Salma', 'Nadia', 'Zineb', 'Imane',
        'Samira', 'Hanane', 'Latifa', 'Karima', 'Naima', 'Sanaa', 'Loubna', 'Asmae',
        'Fatiha', 'Ghita', 'Souad', 'Hind',
    ];
    private array $lastNames = [
        'Alaoui', 'Bennani', 'El Amrani', 'Chraibi', 'Idrissi', 'Tazi', 'Fassi',
        'Berrada', 'El Fassi', 'Kabbaj', 'Benjelloun', 'El Andaloussi', 'Chaoui',
        'Lahlou', 'Sqalli', 'El Khatib', 'Ouazzani', 'Benkirane', 'Slaoui', 'Zniber',
    ];
    private array $diagnoses = [
        'Syndrome grippal', 'Hypertension artérielle - suivi', 'Diabète type 2 - suivi',
        'Lombalgie aiguë', 'Angine érythémateuse', 'Bronchite aiguë', 'Renouvellement ordonnance',
        'Rhinopharyngite', 'Cystite aiguë', 'Migraine', 'Vaccination', 'Certificat médical',
        'Gastrite', 'Entorse de cheville', 'Conjonctivite', 'Allergie saisonnière',
    ];

    private function pick(array $a) { return $a[array_rand($a)]; }
    private function randFloat(float $min, float $max, int $dec = 1): float
    {
        return round($min + mt_rand() / mt_getrandmax() * ($max - $min), $dec);
    }

    public function run(): void
    {
        $today = Carbon::today();

        // ── wipe today's board ────────────────────────────────────────────
        $ids = Appointment::whereDate('appointment_date', $today)->pluck('ID_RV');
        if ($ids->isNotEmpty()) {
            CaseDescription::whereIn('ID_RV', $ids)->delete();
            DB::table('appointment_medicament')->whereIn('ID_RV', $ids)->delete();
            DB::table('appointment_analyse')->whereIn('ID_RV', $ids)->delete();
            Appointment::whereIn('ID_RV', $ids)->delete();
        }
        // prune orphan simulation patients (e.g. from a previous failed run)
        Patient::where('notes', '[SIMULATION]')
            ->whereDoesntHave('Appointment')
            ->delete();

        // status => count. Total = 40. preparing / consulting stay at 1
        // (the board caps those columns at one patient).
        $plan = [
            'Terminé'         => 9,
            'Annulé'          => 2,
            'En préparation'  => 1,
            'En consultation' => 1,
            'Salle dattente'  => 9,
            'Programmé'       => 18,
        ];
        // Chronological through the day, so ticket numbers come out in a
        // believable order: finished first, then the patient in the room,
        // then the one being prepped, then the waiting room.
        $order = ['Terminé' => 0, 'Annulé' => 1, 'En consultation' => 2, 'En préparation' => 3, 'Salle dattente' => 4, 'Programmé' => 5];

        $rows = [];
        foreach ($plan as $status => $n) {
            for ($i = 0; $i < $n; $i++) {
                $rows[] = $status;
            }
        }
        usort($rows, fn ($a, $b) => $order[$a] <=> $order[$b]);

        $start = $today->copy()->setTime(8, 0);
        $ticket = 0;

        foreach ($rows as $idx => $status) {
            $time = $start->copy()->addMinutes($idx * 8);
            // Everyone who has left "Programmé" carries a waiting-room ticket.
            $queue = in_array($status, ['Salle dattente', 'En préparation', 'En consultation', 'Terminé'], true)
                ? ++$ticket
                : null;
            $patient = $this->makePatient();
            $type = $this->pick(['Consultation', 'Consultation', 'Control']);
            $diag = $this->pick($this->diagnoses);

            $appt = Appointment::create([
                'appointment_date' => $today->toDateString(),
                'type'             => $type,
                'status'           => $status,
                'queue_number'     => $queue,
                'diagnostic'       => $status === 'Terminé' ? $diag : null,
                'mutuelle'         => (bool) $patient->mutuelle,
                'payement'         => $status === 'Terminé' ? $this->pick([200, 200, 150, 250, 0]) : 0,
                'ID_patient'       => $patient->ID_patient,
            ]);
            $appt->start_time = $time->toDateTimeString();
            if ($status === 'En consultation') {
                $appt->consultation_started_at = now()->subMinutes(rand(3, 18));
            }
            // Les consultations terminées portent un début et une fin réels :
            // c'est ce couple qui alimente le « temps moyen de consultation »
            // du tableau de bord médecin.
            if ($status === 'Terminé') {
                $appt->consultation_started_at = $time->copy();
                $appt->consultation_ended_at = $time->copy()->addMinutes(rand(8, 26));
            }
            $appt->save();

            // Full case sheet for finished visits; vitals-only for the two
            // in-room steps so the big dashboard cards have constants to show.
            if (in_array($status, ['Terminé', 'En consultation', 'En préparation'], true)) {
                CaseDescription::create([
                    'case_description' => $status === 'Terminé' ? $diag . ' — évolution favorable.' : null,
                    'weight'          => $this->randFloat(45, 95, 1),
                    'pulse'           => rand(60, 95),
                    'temperature'     => $this->randFloat(36.4, 38.5, 1),
                    'blood_pressure'  => rand(100, 145) . '/' . rand(65, 90),
                    'tall'            => $this->randFloat(1.50, 1.90, 2),
                    'spo2'            => rand(95, 100),
                    'ID_RV'           => $appt->ID_RV,
                ]);
            }
        }

        $this->command?->info('Today board seeded: ' . count($rows) . " appointments for {$today->toDateString()}.");
    }

    private function makePatient(): Patient
    {
        $gender = rand(0, 1) ? 'Male' : 'Female';
        $first = $gender === 'Male'
            ? $this->pick($this->maleFirstNames)
            : $this->pick($this->femaleFirstNames);
        $last = $this->pick($this->lastNames);
        $birth = Carbon::now()->subYears(rand(5, 82))->subDays(rand(0, 364));
        $minor = $birth->diffInYears(now()) < 18;

        return Patient::create([
            'first_name'        => $first,
            'last_name'         => $last,
            'birth_day'         => $birth->toDateString(),
            'gender'            => $gender,
            'CIN'               => $minor ? null : strtoupper(chr(rand(65, 90)) . chr(rand(65, 90))) . rand(100000, 999999),
            'guardian_cin'      => $minor ? strtoupper(chr(rand(65, 90))) . rand(100000, 999999) : null,
            'guardian_relation' => $minor ? (rand(0, 1) ? 'father' : 'mother') : null,
            'phone_num'         => '06' . rand(10000000, 99999999),
            'mutuelle'          => $this->pick([null, null, 'CNSS', 'CNOPS']),
            'notes'             => '[SIMULATION]',
            'archived'          => false,
        ]);
    }
}
