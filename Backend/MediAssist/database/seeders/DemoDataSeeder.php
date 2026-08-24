<?php

namespace Database\Seeders;

use App\Models\Analysis;
use App\Models\Appointment;
use App\Models\CaseDescription;
use App\Models\Medicament;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Faker\Factory as FakerFactory;
use Faker\Generator as FakerGenerator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Realistic-looking demo data for a generalist practice — obviously fake
 * (no real patients), meant to make an empty dev install demoable/testable.
 * Safe to re-run: skips creating the doctor account if one already exists,
 * and always adds a fresh batch of patients (so re-running just grows the
 * dataset rather than erroring on unique constraints).
 */
class DemoDataSeeder extends Seeder
{
    private FakerGenerator $faker;

    private array $maleFirstNames = [
        'Mohamed', 'Youssef', 'Ahmed', 'Hamza', 'Karim', 'Rachid', 'Omar', 'Said',
        'Abdelkader', 'Younes', 'Mehdi', 'Anas', 'Bilal', 'Adil', 'Khalid', 'Nabil',
        'Reda', 'Ismail', 'Tarik', 'Amine',
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
        'Syndrome grippal' => ['Fièvre, courbatures, toux sèche depuis 2 jours', ['Paracétamol', 'Vitamine C']],
        'Hypertension artérielle - suivi' => ['Contrôle tensionnel de routine, patient sous traitement', ['Amlodipine', 'Coversyl']],
        'Diabète type 2 - suivi' => ['Contrôle glycémique, observance correcte du traitement', ['Metformine', 'Glucophage']],
        'Lombalgie aiguë' => ['Douleur lombaire suite à un effort, pas de signe neurologique', ['Voltarène', 'Myolastan']],
        'Gastro-entérite aiguë' => ['Diarrhée et vomissements depuis 24h, pas de signe de déshydratation sévère', ['Smecta', 'Loperamide']],
        'Angine érythémateuse' => ['Douleur pharyngée, fièvre, pas de syndrome grippal associé', ['Amoxicilline', 'Doliprane']],
        'Bronchite aiguë' => ['Toux productive, auscultation pulmonaire normale', ['Amoxicilline', 'Bricanyl']],
        'Renouvellement ordonnance' => ['Patient stable, renouvellement du traitement chronique', []],
        'Rhinopharyngite' => ['Écoulement nasal, éternuements, absence de fièvre élevée', ['Doliprane', 'Cétirizine']],
        'Contrôle post-consultation' => ['Évolution favorable depuis la dernière visite', []],
        'Cystite aiguë' => ['Brûlures mictionnelles, pas de fièvre', ['Amoxicilline', 'Ospamox']],
        'Migraine' => ['Céphalées pulsatiles unilatérales, photophobie', ['Ibuprofène', 'Doliprane']],
        'Dyslipidémie - suivi' => ['Bilan lipidique de contrôle demandé', []],
        'Vaccination' => ['Rappel vaccinal, aucune contre-indication', []],
        'Certificat médical' => ['Consultation pour établissement de certificat', []],
        'Gastrite' => ['Douleurs épigastriques post-prandiales', ['Oméprazole', 'Spasfon']],
        'Anxiété - suivi' => ['Consultation de suivi, patient sous traitement anxiolytique léger', ['Lexomil']],
        'Entorse de cheville' => ['Traumatisme sportif, œdème modéré, pas de signe de fracture', ['Voltarène', 'Nifluril']],
        'Conjonctivite' => ['Œil rouge, sécrétions, pas de baisse de vision', []],
        'Allergie saisonnière' => ['Rhinite allergique, prurit oculaire', ['Cétirizine']],
    ];

    private array $medicamentsCatalog = [
        ['Paracétamol', '500mg', 15, 'Antalgique/Antipyrétique', 'N02BE01'],
        ['Doliprane', '1000mg', 22, 'Antalgique/Antipyrétique', 'N02BE01'],
        ['Amoxicilline', '500mg', 35, 'Antibiotique', 'J01CA04'],
        ['Augmentin', '1g', 68, 'Antibiotique', 'J01CR02'],
        ['Ospamox', '1g', 42, 'Antibiotique', 'J01CA04'],
        ['Ibuprofène', '400mg', 25, 'AINS', 'M01AE01'],
        ['Voltarène', '50mg', 38, 'AINS', 'M01AB05'],
        ['Nifluril', '250mg', 45, 'AINS', 'M02AA'],
        ['Efferalgan', '1000mg', 20, 'Antalgique/Antipyrétique', 'N02BE01'],
        ['Spasfon', '80mg', 32, 'Antispasmodique', 'A03AX'],
        ['Smecta', '3g', 28, 'Anti-diarrhéique', 'A07BC05'],
        ['Loperamide', '2mg', 18, 'Anti-diarrhéique', 'A07DA03'],
        ['Motilium', '10mg', 30, 'Anti-émétique', 'A03FA03'],
        ['Amlodipine', '5mg', 40, 'Antihypertenseur', 'C08CA01'],
        ['Coversyl', '5mg', 55, 'Antihypertenseur (IEC)', 'C09AA04'],
        ['Lasilix', '40mg', 26, 'Diurétique', 'C03CA01'],
        ['Metformine', '850mg', 33, 'Antidiabétique', 'A10BA02'],
        ['Glucophage', '1000mg', 48, 'Antidiabétique', 'A10BA02'],
        ['Oméprazole', '20mg', 36, 'Inhibiteur de la pompe à protons', 'A02BC01'],
        ['Mopral', '20mg', 52, 'Inhibiteur de la pompe à protons', 'A02BC01'],
        ['Cétirizine', '10mg', 24, 'Antihistaminique', 'R06AE07'],
        ['Ventoline', 'aérosol', 44, 'Bronchodilatateur', 'R03AC02'],
        ['Bricanyl', 'aérosol', 46, 'Bronchodilatateur', 'R03AC03'],
        ['Solupred', '20mg', 34, 'Corticoïde', 'H02AB06'],
        ['Myolastan', '50mg', 39, 'Myorelaxant', 'M03BX07'],
        ['Lexomil', '6mg', 41, 'Anxiolytique', 'N05BA'],
        ['Daflon', '500mg', 58, 'Veinotonique', 'C05CA53'],
        ['Levothyrox', '75µg', 29, 'Hormone thyroïdienne', 'H03AA01'],
        ['Vitamine C', '1g', 16, 'Complément vitaminique', 'A11GA01'],
        ['Flagyl', '500mg', 31, 'Antibiotique/Antiparasitaire', 'J01XD01'],
    ];

    private array $allergies = [null, null, null, 'Pénicilline', 'Aspirine', 'Iode', 'Pollen', 'Arachides'];
    private array $chronicConditions = [null, null, null, 'Hypertension artérielle', 'Diabète type 2', 'Asthme', 'Hypothyroïdie'];

    public function run(): void
    {
        $this->faker = FakerFactory::create('fr_FR');

        $doctor = $this->ensureDoctor();
        $this->ensureDoctorSettings($doctor);
        $medicaments = $this->ensureMedicaments();

        if (Analysis::count() === 0) {
            Analysis::factory()->count(50)->create();
        }

        $patientsCreated = $this->createPatientsWithHistory($medicaments);

        $this->command?->info("Demo data seeded: doctor login = {$doctor->email} / password123, {$patientsCreated} patients created.");
    }

    private function ensureDoctor(): User
    {
        return User::firstOrCreate(
            ['email' => 'doctor@mediassist.local'],
            [
                'name' => 'Dr. Karim Bennani',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'specialization' => 'Médecine générale',
                'phone' => '0522334455',
            ]
        );
    }

    private function ensureDoctorSettings(User $doctor): void
    {
        DB::table('user_settings')->updateOrInsert(
            ['user_id' => $doctor->id],
            [
                'practice_name' => 'Cabinet Médical Dr. Bennani',
                'specialization' => 'Médecine générale',
                'practice_city' => 'Casablanca',
                'address' => '12 Avenue Hassan II, Casablanca',
                'phone' => '0522334455',
                'default_consultation_price' => 200,
                'default_control_price' => 0,
                'default_control_days' => 15,
                'whatsapp_reminder_hour' => 11,
                'medical_acts' => json_encode([
                    ['name' => 'Consultation', 'price' => 200],
                    ['name' => 'Contrôle', 'price' => 0],
                    ['name' => 'Certificat médical', 'price' => 100],
                    ['name' => 'Vaccination', 'price' => 150],
                    ['name' => 'Pansement', 'price' => 80],
                    ['name' => 'Électrocardiogramme (ECG)', 'price' => 150],
                    ['name' => 'Petite chirurgie', 'price' => 400],
                ]),
                'working_days' => json_encode(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function ensureMedicaments(): array
    {
        if (Medicament::count() > 0) {
            return Medicament::all()->all();
        }
        $created = [];
        foreach ($this->medicamentsCatalog as [$name, $dosage, $price, $classe, $atc]) {
            $created[] = Medicament::create([
                'name' => $name,
                'price' => $price,
                'dosage' => $dosage,
                'Classe_thérapeutique' => $classe,
                'Code_ATCv' => $atc,
                'archived' => false,
            ]);
        }
        return $created;
    }

    private function createPatientsWithHistory(array $medicaments): int
    {
        $analyses = Analysis::all();
        $diagnosisKeys = array_keys($this->diagnoses);
        $count = 25;

        for ($i = 0; $i < $count; $i++) {
            $gender = $this->faker->boolean() ? 'Male' : 'Female';
            $firstName = $gender === 'Male'
                ? $this->maleFirstNames[array_rand($this->maleFirstNames)]
                : $this->femaleFirstNames[array_rand($this->femaleFirstNames)];
            $lastName = $this->lastNames[array_rand($this->lastNames)];
            $birthDate = Carbon::now()->subYears(rand(4, 82))->subDays(rand(0, 365));
            $isMinor = $birthDate->diffInYears(now()) < 18;

            $patient = Patient::create([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'birth_day' => $birthDate->toDateString(),
                'gender' => $gender,
                'CIN' => $isMinor ? null : strtoupper(chr(rand(65, 90)) . chr(rand(65, 90))) . rand(100000, 999999),
                'guardian_cin' => $isMinor ? strtoupper(chr(rand(65, 90))) . rand(100000, 999999) : null,
                'guardian_relation' => $isMinor ? ($this->faker->boolean() ? 'father' : 'mother') : null,
                'phone_num' => '06' . rand(10000000, 99999999),
                'email' => $this->faker->boolean(40) ? strtolower($firstName . '.' . $lastName . rand(1, 99) . '@gmail.com') : null,
                'mutuelle' => $this->faker->randomElement([null, null, 'CNSS', 'CNOPS']),
                'allergies' => $this->allergies[array_rand($this->allergies)],
                'chronic_conditions' => $this->chronicConditions[array_rand($this->chronicConditions)],
                'blood_type' => $this->faker->randomElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null]),
                'archived' => false,
            ]);

            $visitCount = rand(1, 5);
            $cursor = Carbon::now()->subDays(rand(30, 240));

            for ($v = 0; $v < $visitCount; $v++) {
                $cursor = $cursor->copy()->addDays(rand(15, 60));
                $isFuture = $cursor->isFuture();
                $status = $isFuture
                    ? 'Programmé'
                    : $this->faker->randomElement(['Terminé', 'Terminé', 'Terminé', 'Terminé', 'Annulé']);

                $diagKey = $diagnosisKeys[array_rand($diagnosisKeys)];
                [$description, $medNames] = $this->diagnoses[$diagKey];

                $appointment = Appointment::create([
                    'appointment_date' => $cursor->toDateString(),
                    'type' => $this->faker->randomElement(['Consultation', 'Consultation', 'Control']),
                    'status' => $status,
                    'diagnostic' => $status === 'Terminé' ? $diagKey : null,
                    'mutuelle' => (bool) $patient->mutuelle,
                    'payement' => $status === 'Terminé' ? $this->faker->randomElement([200, 200, 150, 250, 0]) : 0,
                    'ID_patient' => $patient->ID_patient,
                ]);

                if ($status !== 'Terminé') {
                    continue;
                }

                CaseDescription::create([
                    'case_description' => $description,
                    'weight' => round($this->faker->randomFloat(1, 45, 95), 1),
                    'pulse' => rand(60, 95),
                    'temperature' => round($this->faker->randomFloat(1, 36.4, 38.5), 1),
                    'blood_pressure' => rand(100, 145) . '/' . rand(65, 90),
                    'tall' => round($this->faker->randomFloat(2, 1.50, 1.90), 2),
                    'spo2' => rand(95, 100),
                    'notes' => $this->faker->boolean(30) ? 'Contrôle recommandé dans 1 mois si absence d\'amélioration.' : null,
                    'ID_RV' => $appointment->ID_RV,
                ]);

                foreach ($medNames as $medName) {
                    $med = collect($medicaments)->firstWhere('name', $medName);
                    if (!$med) {
                        continue;
                    }
                    DB::table('appointment_medicament')->insert([
                        'ID_RV' => $appointment->ID_RV,
                        'ID_Medicament' => $med->ID_Medicament,
                        'dosage' => $med->dosage,
                        'frequence' => $this->faker->randomElement(['1x/jour', '2x/jour', '3x/jour']),
                        'duree' => $this->faker->randomElement(['5 jours', '7 jours', '10 jours', '1 mois']),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                if ($this->faker->boolean(35) && $analyses->count() > 0) {
                    foreach ($analyses->random(rand(1, 2)) as $analyse) {
                        DB::table('appointment_analyse')->insert([
                            'ID_RV' => $appointment->ID_RV,
                            'ID_Analyse' => $analyse->ID_Analyse,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }
        }

        return $count;
    }
}
