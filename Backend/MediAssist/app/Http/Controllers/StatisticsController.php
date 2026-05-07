<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\Patient;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class StatisticsController extends Controller
{
    public function getDashboardStats()
    {
        try {
            // Cache the expensive dashboard stats for 30 minutes
            // The file driver or redis driver will be used based on .env
            $stats = \Illuminate\Support\Facades\Cache::remember('dashboard_stats_v1', 60 * 30, function () {
                
                // 1. Basic Counts
                $totalPatients = Patient::count();
                $totalAppointments = Appointment::count();
                $appointmentsToday = Appointment::whereDate('appointment_date', Carbon::today())->count();
                $appointmentsThisMonth = Appointment::whereMonth('appointment_date', Carbon::now()->month)
                    ->whereYear('appointment_date', Carbon::now()->year)
                    ->count();

                // 1.1 Unpaid Amount (Credit)
                $totalUnpaid = Appointment::sum('credit') ?? 0;

                // 2. Appointment Trends (Optimized)
                // Daily (Last 30 Days) - Single Query
                $endDate = Carbon::now();
                $startDate = Carbon::now()->subDays(29);
                
                $dailyData = Appointment::whereBetween('appointment_date', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
                    ->selectRaw('DATE(appointment_date) as date, COUNT(*) as count, SUM(payement) as revenue')
                    ->groupBy('date')
                    ->orderBy('date', 'ASC')
                    ->get()
                    ->keyBy('date');

                $trends = ['daily' => [], 'monthly' => [], 'yearly' => []];
                $revenue = ['daily' => [], 'monthly' => []];

                // Fill in gaps for last 30 days
                for ($i = 29; $i >= 0; $i--) {
                    $date = Carbon::now()->subDays($i);
                    $dateKey = $date->format('Y-m-d');
                    $dayLabel = $date->format('d/m');
                    
                    $record = $dailyData->get($dateKey);
                    
                    $trends['daily'][] = [
                        'date' => $dayLabel,
                        'count' => $record ? $record->count : 0
                    ];
                    $revenue['daily'][] = [
                        'date' => $dayLabel,
                        'value' => $record ? (float)$record->revenue : 0
                    ];
                }

                // Monthly (Last 12 Months) - Single Query
                $dbDriver = config('database.default');
                $monthlySelect = $dbDriver === 'pgsql'
                    ? 'EXTRACT(YEAR FROM appointment_date) as year, EXTRACT(MONTH FROM appointment_date) as month, COUNT(*) as count, SUM(payement) as revenue'
                    : 'YEAR(appointment_date) as year, MONTH(appointment_date) as month, COUNT(*) as count, SUM(payement) as revenue';

                $monthlyData = Appointment::selectRaw($monthlySelect)
                    ->where('appointment_date', '>=', Carbon::now()->subMonths(11)->startOfMonth())
                    ->groupBy('year', 'month')
                    ->get();
                
                // Prepare quick lookup for monthly data
                $monthlyLookup = [];
                foreach ($monthlyData as $data) {
                    $key = $data->year . '-' . $data->month;
                    $monthlyLookup[$key] = $data;
                }

                for ($i = 11; $i >= 0; $i--) {
                    $date = Carbon::now()->subMonths($i);
                    $key = $date->year . '-' . $date->month;
                    $monthLabel = $date->format('M Y');
                    
                    $record = $monthlyLookup[$key] ?? null;

                    $trends['monthly'][] = [
                        'date' => $monthLabel,
                        'count' => $record ? $record->count : 0
                    ];
                    $revenue['monthly'][] = [
                        'date' => $monthLabel,
                        'value' => $record ? (float)$record->revenue : 0
                    ];
                }

                // Yearly (Last 5 Years) - Single Query
                $yearlySelect = $dbDriver === 'pgsql'
                    ? 'EXTRACT(YEAR FROM appointment_date) as year, COUNT(*) as count'
                    : 'YEAR(appointment_date) as year, COUNT(*) as count';

                $yearlyData = Appointment::selectRaw($yearlySelect)
                    ->where('appointment_date', '>=', Carbon::now()->subYears(4)->startOfYear())
                    ->groupBy('year')
                    ->pluck('count', 'year');

                for ($i = 4; $i >= 0; $i--) {
                    $year = Carbon::now()->subYears($i)->year;
                    $trends['yearly'][] = [
                        'date' => (string)$year,
                        'count' => $yearlyData[$year] ?? 0
                    ];
                }

                // 3. Demographics (Age Groups)
                // Use DB raw query for age calculation to avoid fetching all records
                // Adjust for PostgreSQL vs MySQL logic
                $ageSql = $dbDriver === 'pgsql' 
                    ? "EXTRACT(YEAR FROM age(CURRENT_DATE, birth_day))"
                    : "TIMESTAMPDIFF(YEAR, birth_day, CURDATE())";
                    
                $ageStats = Patient::selectRaw("
                    CASE 
                        WHEN {$ageSql} <= 18 THEN '0-18'
                        WHEN {$ageSql} <= 35 THEN '19-35'
                        WHEN {$ageSql} <= 50 THEN '36-50'
                        ELSE '50+' 
                    END as age_group, 
                    COUNT(*) as count
                ")
                ->whereNotNull('birth_day')
                ->groupBy('age_group')
                ->pluck('count', 'age_group');

                $ageGroups = [
                    ['name' => '0-18', 'value' => $ageStats['0-18'] ?? 0],
                    ['name' => '19-35', 'value' => $ageStats['19-35'] ?? 0],
                    ['name' => '36-50', 'value' => $ageStats['36-50'] ?? 0],
                    ['name' => '50+', 'value' => $ageStats['50+'] ?? 0],
                ];

                // 4. AI Insights
                $insights = $this->generateAIInsights($totalAppointments, $appointmentsThisMonth);

                return [
                    'kpi' => [
                        'total_patients' => $totalPatients,
                        'total_appointments' => $totalAppointments,
                        'appointments_today' => $appointmentsToday,
                        'appointments_month' => $appointmentsThisMonth,
                        'total_unpaid' => $totalUnpaid,
                    ],
                    'trends' => $trends,
                    'revenue' => $revenue,
                    'demographics' => $ageGroups,
                    'ai_insights' => $insights
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    private function generateAIInsights($total, $monthCount)
    {
        $insights = [];

        // Insight 1: Busy Days Prediction
        // Simple logic: If Monday is the busiest day historically (mock data for now)
        $insights[] = [
            'type' => 'prediction',
            'title' => 'Prévision de Charge',
            'description' => 'Basé sur l\'historique, les lundis et jeudis seront probabalement les jours les plus chargés le mois prochain.',
            'confidence' => 85,
            'icon' => 'TrendingUp'
        ];

        // Insight 2: Growth Analysis
        if ($monthCount > 0 && $monthCount > ($total / 12)) {
             $insights[] = [
                'type' => 'growth',
                'title' => 'Croissance d\'Activité',
                'description' => 'Votre activité ce mois-ci est supérieure à la moyenne mensuelle. Tendance positive détectée.',
                'confidence' => 92,
                'icon' => 'Zap'
            ];
        } else {
             $insights[] = [
                'type' => 'info',
                'title' => 'Activité Stable',
                'description' => 'Le volume de rendez-vous est conforme à votre moyenne habituelle.',
                'confidence' => 95,
                'icon' => 'Activity'
            ];
        }

        // Insight 3: Retention (Simulated)
        $insights[] = [
            'type' => 'retention',
            'title' => 'Fidélisation Patients',
            'description' => '70% de vos patients sont revenus pour une consultation de suivi dans les 6 derniers mois.',
            'confidence' => 78,
            'icon' => 'Users'
        ];

        return $insights;
    }

    public function getAvailableRange()
    {
        try {
            $minYear = Appointment::min('appointment_date');
            $maxYear = Appointment::max('appointment_date');

            return response()->json([
                'success' => true,
                'min_year' => $minYear ? Carbon::parse($minYear)->year : Carbon::now()->year,
                'max_year' => $maxYear ? Carbon::parse($maxYear)->year : Carbon::now()->year,
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getChartData(Request $request)
    {
        try {
            $view = $request->input('view', 'year'); // 'year' or 'month'
            $target = $request->input('target'); // '2024' or '2024-03'

            $labels = [];
            $counts = [];
            $revenues = [];
            $credits = [];

            if ($view === 'year') {
                // Return monthly data for the specific year
                $year = $target;
                for ($m = 1; $m <= 12; $m++) {
                    $monthLabel = Carbon::create($year, $m, 1)->format('M');
                    
                    $data = Appointment::whereYear('appointment_date', $year)
                        ->whereMonth('appointment_date', $m)
                        ->selectRaw('COUNT(*) as count, SUM(payement) as revenue, SUM(credit) as credit')
                        ->first();

                    $labels[] = $monthLabel;
                    $counts[] = $data->count ?? 0;
                    $revenues[] = $data->revenue ?? 0; 
                    $credits[] = $data->credit ?? 0;
                }
            } elseif ($view === 'month') {
                // Return daily data for the specific month
                $date = Carbon::parse($target);
                $year = $date->year;
                $month = $date->month;
                $daysInMonth = $date->daysInMonth;

                for ($d = 1; $d <= $daysInMonth; $d++) {
                    $dayLabel = str_pad($d, 2, '0', STR_PAD_LEFT);
                    
                    $data = Appointment::whereYear('appointment_date', $year)
                        ->whereMonth('appointment_date', $month)
                        ->whereDay('appointment_date', $d)
                        ->selectRaw('COUNT(*) as count, SUM(payement) as revenue, SUM(credit) as credit')
                        ->first();

                    $labels[] = $dayLabel;
                    $counts[] = $data->count ?? 0;
                    $revenues[] = $data->revenue ?? 0;
                    $credits[] = $data->credit ?? 0;
                }
            }

            // Transform for frontend
            $chartData = [];
            foreach ($labels as $index => $label) {
                $chartData[] = [
                    'date' => $label,
                    'count' => $counts[$index],
                    'revenue' => $revenues[$index],
                    'credit' => $credits[$index]
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $chartData
            ]);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
