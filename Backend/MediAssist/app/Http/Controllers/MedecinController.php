<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Patient;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class MedecinController extends Controller
{
    public function dashboard()
    {
        try {

            $today = now()->format('Y-m-d');

            // 1. Single query for ALL of today's appointments
            $todayAppointments = Appointment::with(['patient', 'caseDescription', 'medicaments']) // Preload everything needed
                ->whereDate('appointment_date', $today)
                ->get();

            // 2. Filter collections in memory (much faster for typical daily volume < 100)
            $currentPatient = $todayAppointments->where('status', 'En consultation')->sortByDesc('created_at')->first();
            
            // Re-fetch current patient to ensure we have latest relation if needed, or rely on eager load
            // Actually, we need 'caseDescription' which is preloaded.
            // But we need 'patientHistory' for this specific patient.
            
            $patientHistory = [];
            if ($currentPatient) {
                // This one still needs a separate query because it looks at PAST dates
                $patientHistory = Appointment::with(['medicaments', 'caseDescription'])
                    ->where('ID_patient', $currentPatient->ID_patient)
                    ->where('ID_RV', '!=', $currentPatient->ID_RV)
                    ->orderBy('appointment_date', 'desc')
                    ->take(5)
                    ->get();
            }

            $waitingPatients   = $todayAppointments->where('status', 'Salle dattente')->sortBy('created_at')->values();
            $preparingPatients = $todayAppointments->where('status', 'En préparation')->sortBy('updated_at')->values();
            $completedPatients = $todayAppointments->where('status', 'Terminé')->sortByDesc('updated_at')->values();
            $cancelledPatients = $todayAppointments->where('status', 'Annulé')->sortByDesc('updated_at')->values();

            // 3. Upcoming (Future dates) - Independent query
            $upcomingAppointments = Appointment::with('patient')
                ->whereDate('appointment_date', '>', $today)
                ->orderBy('appointment_date', 'asc')
                ->limit(10)
                ->get();

            // 4. Counts
            $totalPatients = Patient::count(); // Keep this simple query
            $todayPatients = $todayAppointments->count();
            
            $activeAppointments = $todayAppointments->whereIn('status', ['Salle dattente', 'En préparation', 'En consultation'])->count();

            // 5. Revenue & Stats (In Memory)
            $averageConsultationTime = $this->computeAverageConsultationTime($completedPatients);
            $dailyRevenue = $completedPatients->sum('payement');
            $completedRevenue = $dailyRevenue;
            
            $pendingRevenue = $todayAppointments->whereIn('status', ['Salle dattente', 'En préparation', 'En consultation'])->sum('payement');

            $paymentBreakdown = [
                'cash'     => $completedPatients->where('mutuelle', 'Espèces')->sum('payement'), // Assuming 'mutuelle' stores payment mode based on prev logic?
                // Wait, previous code used `where('mutuelle', 'Espèces')`. 
                // Let's verify if `mutuelle` column holds 'Espèces' or if that was a misunderstanding of the legacy code.
                // In `AppointmentController::storeV1`, mutuelle is boolean.
                // In `MedecinController` original code: `$completedPatients->where('mutuelle', 'Espèces')`.
                // This implies `mutuelle` field is possibly misused or polymorphic string?
                // Let's keep strict equality to previous logic.
                'cash'     => $completedPatients->where('mutuelle', 'Espèces')->sum('payement'),
                'card'     => $completedPatients->where('mutuelle', 'Carte')->sum('payement'),
                'cheque'   => $completedPatients->where('mutuelle', 'Chèque')->sum('payement'),
                'mutuelle' => $completedPatients->where('mutuelle', 'Mutuelle')->sum('payement'),
                'pending'  => $pendingRevenue
            ];

            $revenueByType = [];
            foreach ($completedPatients as $appointment) {
                $type = $appointment->type ?? 'Autre';
                if (!isset($revenueByType[$type])) {
                    $revenueByType[$type] = ['count' => 0, 'amount' => 0];
                }
                $revenueByType[$type]['count']++;
                $revenueByType[$type]['amount'] += $appointment->payement ?? 0;
            }

            $statusCounts = [
                'waiting'     => $waitingPatients->count(),
                'preparing'   => $preparingPatients->count(),
                'consulting'  => $currentPatient ? 1 : 0,
                'completed'   => $completedPatients->count(),
                'cancelled'   => $cancelledPatients->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'totalPatients'          => $totalPatients,
                    'todayPatients'          => $todayPatients,
                    'activeAppointments'     => $activeAppointments,

                    'currentPatient'         => $currentPatient,
                    'patientHistory'         => $patientHistory,
                    'waitingPatients'        => $waitingPatients,
                    'preparingPatients'      => $preparingPatients,
                    'completedPatients'      => $completedPatients,
                    'cancelledPatients'      => $cancelledPatients,
                    'upcomingAppointments'   => $upcomingAppointments,

                    'averageConsultationTime'=> $averageConsultationTime,

                    'dailyRevenue'           => $dailyRevenue,
                    'completedRevenue'       => $completedRevenue,
                    'pendingRevenue'         => $pendingRevenue,

                    'paymentBreakdown'       => $paymentBreakdown,
                    'revenueByType'          => $revenueByType,

                    'statusCounts'           => $statusCounts,
                ]
            ]);

        } catch (\Exception $e) {

            Log::error("Dashboard error: ".$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => "Erreur lors du chargement du dashboard",
                'error'   => $e->getMessage()
            ], 500);
        }
    }


    /**
     * Duree moyenne d'une consultation, en minutes.
     *
     * Carbon 3 renvoie une difference *signee* : `$fin->diffInMinutes($debut)`
     * vaut -25 et non 25. L'ancien code testait `> 0` sur cette valeur, si bien
     * qu'aucune consultation n'etait jamais comptee et que la moyenne affichait
     * toujours 0. On mesure donc du debut vers la fin, avec abs() comme
     * garde-fou si les deux horodatages sont inverses en base.
     */
    private function computeAverageConsultationTime($appointments)
    {
        if ($appointments->isEmpty()) {
            return 0;
        }

        // Au-dela de 4 h il s'agit d'un statut oublie, pas d'une vraie duree.
        $maxMinutes = 240;
        $totalMinutes = 0;
        $count = 0;

        foreach ($appointments as $appointment) {
            $minutes = null;

            // 1. Les horodatages dedies, quand la consultation a ete suivie.
            if ($appointment->consultation_started_at && $appointment->consultation_ended_at) {
                $minutes = abs(Carbon::parse($appointment->consultation_started_at)
                    ->diffInMinutes(Carbon::parse($appointment->consultation_ended_at)));
            }

            // 2. Sinon, l'ecart creation -> derniere modification de la fiche.
            if (($minutes === null || $minutes <= 0) && $appointment->created_at && $appointment->updated_at) {
                $minutes = abs(Carbon::parse($appointment->created_at)
                    ->diffInMinutes(Carbon::parse($appointment->updated_at)));
            }

            if ($minutes !== null && $minutes > 0 && $minutes < $maxMinutes) {
                $totalMinutes += $minutes;
                $count++;
            }
        }

        return $count > 0 ? (int) round($totalMinutes / $count) : 0;
    }

    public function updateStatus(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'appointment_id' => 'required|exists:appointments,ID_RV',
            'status' => 'required|string'
        ]);

        $appointment = Appointment::find($validated['appointment_id']);
        $appointment->status = $validated['status'];

        if ($validated['status'] === 'Terminé') {
            $appointment->consultation_ended_at = now();
        }

        $appointment->save();

        return response()->json([
            'success' => true,
            'status' => $appointment->status
        ]);
    }

    public function navigatePatient(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'direction' => 'required|in:next,previous'
        ]);
        
        $today = now()->format('Y-m-d');
        
        if ($validated['direction'] === 'next') {
            // Logic: Take the first waiting patient and move them to consulting
            
            // 1. Check if there is already someone in consultation? 
            // Ideally we might want to finish them, but the user might just want to switch
            // For now, let's just grab the next one.
            
            $nextPatient = Appointment::where('status', 'Salle dattente')
                ->whereDate('appointment_date', $today)
                ->orderBy('created_at', 'asc') // First in first out
                ->first();

            if (!$nextPatient) {
                // Check preparing?
                $nextPatient = Appointment::where('status', 'En préparation')
                    ->whereDate('appointment_date', $today)
                    ->orderBy('created_at', 'asc')
                    ->first();
            }
            
            if ($nextPatient) {
                $nextPatient->status = 'En consultation';
                $nextPatient->consultation_started_at = now();
                $nextPatient->save();
                return response()->json(['success' => true, 'appointment' => $nextPatient]);
            }
            
            return response()->json(['success' => false, 'message' => 'Aucun patient en attente']);

        } else {
            // Previous: Logic to "undo" or just go back? 
            // The UI button says "Précédent". Usually this means taking the last FINISHED patient back to consulting?
            // Or just showing the previous patient in the list?
            // Given the context of a queue, "Previous" usually implies picking up the last person who was seen.
            
            $lastPatient = Appointment::where('status', 'Terminé')
                ->whereDate('appointment_date', $today)
                ->orderBy('updated_at', 'desc') // Most recently finished
                ->first();
                
            if ($lastPatient) {
                $lastPatient->status = 'En consultation';
                // Usually we shouldn't reset start time here as it's a resume? 
                // But for simplicity let's leave it or set it if null.
                if (!$lastPatient->consultation_started_at) {
                    $lastPatient->consultation_started_at = now();
                }
                $lastPatient->save();
                return response()->json(['success' => true, 'appointment' => $lastPatient]);
            }
            
            return response()->json(['success' => false, 'message' => 'Aucun patient précédent trouvé']);
        }
    }

    public function returnToConsultation(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'appointment_id' => 'required|exists:appointments,ID_RV'
        ]);

        $appointment = Appointment::find($validated['appointment_id']);
        $appointment->status = 'En consultation';
        
        // Convert to Carbon/DateTime string for now()
        // If coming from another state back to consultation, maybe we update start time?
        // Or keep original? Let's treat it as a new segment for simplicity in "current patient" logic
        // but average time might get tricky. 
        // Best approach: If it was NULL, set it. If it was set, maybe keep it?
        // Let's set it if null.
        if (!$appointment->consultation_started_at) {
            $appointment->consultation_started_at = now();
        }
        
        $appointment->save();

        return response()->json([
            'success' => true,
            'appointment' => $appointment
        ]);
    }

    public function getAppointmentsByDate($date)
    {
         $appointments = Appointment::with('patient')
            ->whereDate('appointment_date', $date)
            ->get(); // You might want to format this or group it

         return response()->json(['success' => true, 'data' => $appointments]);
    }
}
