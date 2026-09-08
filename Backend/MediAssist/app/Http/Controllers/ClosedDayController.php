<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\ClosedDay;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Jours de fermeture du cabinet.
 *
 * Fermer un jour empêche le personnel d'y programmer un rendez-vous, mais ne
 * touche jamais aux rendez-vous déjà pris : la réponse renvoie la liste des
 * patients concernés, avec leur téléphone, pour que le cabinet les appelle et
 * convienne d'une autre date.
 */
class ClosedDayController extends Controller
{
    /** Seul le médecin (compte admin) décide des jours de fermeture. */
    private function denyIfNotDoctor(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Non authentifié'], 401);
        }
        if (($user->role ?? null) !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => "Seul le médecin peut modifier les jours de fermeture.",
            ], 403);
        }
        return null;
    }

    /** Le jour est-il fermé ? Utilisé par la prise de rendez-vous. */
    public static function isClosed(string $date): ?ClosedDay
    {
        try {
            return ClosedDay::whereDate('date', $date)->first();
        } catch (\Throwable $e) {
            // Table absente (migration non jouée) : ne bloque jamais la prise de RDV.
            return null;
        }
    }

    /** GET /api/closed-days?from=YYYY-MM-DD&to=YYYY-MM-DD */
    public function index(Request $request)
    {
        $from = $request->query('from') ?: Carbon::today()->subMonth()->toDateString();
        $to = $request->query('to') ?: Carbon::today()->addMonths(6)->toDateString();

        $days = ClosedDay::whereBetween('date', [$from, $to])
            ->orderBy('date')
            ->get()
            ->map(fn ($d) => [
                'date' => $d->date->toDateString(),
                'reason' => $d->reason,
            ]);

        // Nombre de rendez-vous encore programmés sur ces jours : le médecin
        // doit voir d'un coup d'œil lesquels demandent un appel.
        $dates = $days->pluck('date')->all();
        $pending = [];
        if ($dates) {
            $pending = Appointment::whereIn('appointment_date', $dates)
                ->whereNotIn('status', ['Annulé', 'Terminé'])
                ->selectRaw('appointment_date, COUNT(*) as n')
                ->groupBy('appointment_date')
                ->pluck('n', 'appointment_date')
                ->all();
        }

        return response()->json([
            'success' => true,
            'closed_days' => $days->map(function ($d) use ($pending) {
                $key = $d['date'];
                $d['pending'] = (int) ($pending[$key] ?? $pending[$key . ' 00:00:00'] ?? 0);
                return $d;
            })->values(),
        ]);
    }

    /**
     * GET /api/closed-days/impact/{date}
     * Qui est déjà programmé ce jour-là — à appeler avant de fermer.
     */
    public function impact($date)
    {
        try {
            $day = Carbon::parse($date)->toDateString();
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Date invalide'], 422);
        }

        $appointments = Appointment::with('patient')
            ->whereDate('appointment_date', $day)
            ->whereNotIn('status', ['Annulé', 'Terminé'])
            ->orderBy('start_time')
            ->get()
            ->map(fn ($a) => [
                'ID_RV' => $a->ID_RV,
                'ID_patient' => $a->ID_patient,
                'status' => $a->status,
                'type' => $a->type,
                'start_time' => $a->start_time,
                'patient' => [
                    'first_name' => $a->patient->first_name ?? '',
                    'last_name' => $a->patient->last_name ?? '',
                    'phone_num' => $a->patient->phone_num ?? null,
                ],
            ]);

        return response()->json([
            'success' => true,
            'date' => $day,
            'count' => $appointments->count(),
            'appointments' => $appointments,
        ]);
    }

    /** POST /api/closed-days  { date, reason? } */
    public function store(Request $request)
    {
        if ($deny = $this->denyIfNotDoctor($request)) {
            return $deny;
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'reason' => 'nullable|string|max:255',
        ]);
        $day = Carbon::parse($validated['date'])->toDateString();

        try {
            $closed = ClosedDay::updateOrCreate(
                ['date' => $day],
                ['reason' => $validated['reason'] ?? null, 'created_by' => $request->user()->id],
            );

            // On renvoie les rendez-vous restants : le jour est fermé pour toute
            // nouvelle prise, mais ceux-ci attendent un appel, pas une suppression.
            $impact = $this->impact($day)->getData(true);

            return response()->json([
                'success' => true,
                'closed_day' => ['date' => $day, 'reason' => $closed->reason],
                'pending_count' => $impact['count'] ?? 0,
                'appointments' => $impact['appointments'] ?? [],
                'message' => ($impact['count'] ?? 0) > 0
                    ? "Journée fermée. {$impact['count']} rendez-vous déjà programmé(s) : à replanifier avec les patients."
                    : 'Journée fermée.',
            ]);
        } catch (\Throwable $e) {
            Log::error('closed day store failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Impossible de fermer cette journée'], 500);
        }
    }

    /** DELETE /api/closed-days/{date} — rouvre la journée. */
    public function destroy(Request $request, $date)
    {
        if ($deny = $this->denyIfNotDoctor($request)) {
            return $deny;
        }

        try {
            $day = Carbon::parse($date)->toDateString();
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Date invalide'], 422);
        }

        ClosedDay::whereDate('date', $day)->delete();

        return response()->json(['success' => true, 'message' => 'Journée rouverte.']);
    }
}
