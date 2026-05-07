"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { apiClient } from "@/lib/api"
import { Loader2, TrendingUp, Users, Calendar, Activity, Zap, AlertCircle, DollarSign, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Area,
    AreaChart,
} from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StatsData {
    kpi: {
        total_patients: number
        total_appointments: number
        appointments_today: number
        appointments_month: number
        total_unpaid?: number
    }
    demographics: Array<{
        name: string
        value: number
    }>
    ai_insights: Array<{
        type: string
        title: string
        description: string
        confidence: number
        icon: string
    }>
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]

export default function StatisticsPage() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<StatsData | null>(null)

    // Chart Filter States
    const [viewMode, setViewMode] = useState<'year' | 'month'>('year')
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
    const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString())
    const [availableYears, setAvailableYears] = useState<number[]>([])

    const [chartData, setChartData] = useState<Array<{ date: string; count: number; revenue: number; credit: number }>>([])
    const [chartLoading, setChartLoading] = useState(false)

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [statsResponse, rangeResponse] = await Promise.all([
                    apiClient.getDoctorStats(),
                    apiClient.getStatsRange()
                ])

                if (statsResponse.success && statsResponse.data) {
                    setData(statsResponse.data.data || statsResponse.data)
                }

                if (rangeResponse.success && rangeResponse.data) {
                    const { min_year, max_year } = rangeResponse.data
                    const years = []
                    for (let y = max_year; y >= min_year; y--) {
                        years.push(y)
                    }
                    if (years.length === 0) years.push(new Date().getFullYear())
                    setAvailableYears(years)
                }
            } catch (error) {
                console.error("Error fetching initial stats:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchInitialData()
    }, [])

    useEffect(() => {
        const fetchChartData = async () => {
            setChartLoading(true)
            try {
                let target = selectedYear
                if (viewMode === 'month') {
                    // format YYYY-MM
                    target = `${selectedYear}-${selectedMonth.padStart(2, '0')}`
                }

                const response = await apiClient.getChartData(viewMode, target)

                if (response.success && response.data) {
                    // unexpected: api returns {success:true, data: [...]} which is in response.data
                    // so we need response.data.data
                    const responseData = response.data as any
                    const items = responseData.data || []

                    if (Array.isArray(items)) {
                        setChartData(items)
                    } else {
                        console.error("Invalid chart data format:", items)
                        setChartData([])
                    }
                }
            } catch (error) {
                console.error("Error fetching chart data:", error)
            } finally {
                setChartLoading(false)
            }
        }

        if (!loading) {
            fetchChartData()
        }
    }, [viewMode, selectedYear, selectedMonth, loading])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (!data) {
        return <div className="p-8 text-center text-red-500">Erreur lors du chargement des statistiques.</div>
    }

    const monthNames = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ]

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Tableau de Bord IA & Statistiques</h1>
                <p className="text-gray-500 mt-2">Vue d'overview de votre activité et insights prédictifs</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Patients</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-800">{data.kpi.total_patients}</div>
                        <p className="text-xs text-gray-500 mt-1">Base patients active</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Rendez-vous (Auj)</CardTitle>
                        <Calendar className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-800">{data.kpi.appointments_today}</div>
                        <p className="text-xs text-gray-500 mt-1">Aujourd'hui</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Activité Mensuelle</CardTitle>
                        <Activity className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-800">{data.kpi.appointments_month}</div>
                        <p className="text-xs text-gray-500 mt-1">Rendez-vous ce mois-ci</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Unpayé</CardTitle>
                        <DollarSign className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{data.kpi.total_unpaid || 0} DH</div>
                        <p className="text-xs text-gray-500 mt-1">Total des crédits patients</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-orange-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-600">Score IA</CardTitle>
                        <Zap className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-800">92/100</div>
                        <p className="text-xs text-orange-600 mt-1">Status: Excellent</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Vue:</span>
                    <div className="flex bg-gray-100 p-1 rounded-md">
                        <Button
                            variant={viewMode === 'year' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('year')}
                            className="h-8 text-xs"
                        >
                            Par Année
                        </Button>
                        <Button
                            variant={viewMode === 'month' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('month')}
                            className="h-8 text-xs"
                        >
                            Par Mois
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Année:</span>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue placeholder="Année" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableYears.map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {viewMode === 'month' && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Mois:</span>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Mois" />
                            </SelectTrigger>
                            <SelectContent>
                                {monthNames.map((name, index) => (
                                    <SelectItem key={index} value={(index + 1).toString()}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Trends Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-blue-600" />
                                Tendance des Rendez-vous
                            </CardTitle>
                            <CardDescription>
                                {viewMode === 'year'
                                    ? `Volume mensuel pour ${selectedYear}`
                                    : `Volume journalier pour ${monthNames[parseInt(selectedMonth) - 1]} ${selectedYear}`
                                }
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {chartLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                        cursor={{ fill: "#f3f4f6" }}
                                    />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={viewMode === 'month' ? 15 : 30} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                Coût Total
                            </CardTitle>
                            <CardDescription>
                                {viewMode === 'year'
                                    ? `Coût mensuel pour ${selectedYear}`
                                    : `Coût journalier pour ${monthNames[parseInt(selectedMonth) - 1]} ${selectedYear}`
                                }
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {chartLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                                    <Tooltip
                                        formatter={(value) => [`${value} DH`, "Coût"]}
                                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Credit Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-amber-500" />
                                Crédits (Reste)
                            </CardTitle>
                            <CardDescription>
                                {viewMode === 'year'
                                    ? `Crédit mensuel pour ${selectedYear}`
                                    : `Crédit journalier pour ${monthNames[parseInt(selectedMonth) - 1]} ${selectedYear}`
                                }
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {chartLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                                    <Tooltip
                                        formatter={(value) => [`${value} DH`, "Crédits"]}
                                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                    />
                                    <Area type="monotone" dataKey="credit" stroke="#f59e0b" fillOpacity={1} fill="url(#colorCredit)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Demographics */}
                <Card>
                    <CardHeader>
                        <CardTitle>Démographie Patients</CardTitle>
                        <CardDescription>Répartition par âge</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.demographics}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.demographics.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                    <div className="flex justify-center gap-4 pb-4 text-xs text-gray-500">
                        {data.demographics.map((entry, index) => (
                            <div key={index} className="flex items-center">
                                <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* AI Insights & Recommendations */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                        Insights Prédictifs
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.ai_insights.map((insight, index) => (
                            <Card key={index} className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
                                <div className={`h-1 w-full ${insight.type === 'prediction' ? 'bg-blue-500' :
                                    insight.type === 'growth' ? 'bg-green-500' :
                                        'bg-purple-500'
                                    }`}></div>
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-full ${insight.type === 'prediction' ? 'bg-blue-100 text-blue-600' :
                                            insight.type === 'growth' ? 'bg-green-100 text-green-600' :
                                                'bg-purple-100 text-purple-600'
                                            }`}>
                                            {insight.icon === 'TrendingUp' && <TrendingUp className="w-5 h-5" />}
                                            {insight.icon === 'Zap' && <Zap className="w-5 h-5" />}
                                            {insight.icon === 'Activity' && <Activity className="w-5 h-5" />}
                                            {insight.icon === 'Users' && <Users className="w-5 h-5" />}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confiance</span>
                                            <div className="text-lg font-bold text-gray-800">{insight.confidence}%</div>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{insight.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        {insight.description}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
                        <CardContent className="p-6">
                            <div className="flex items-center mb-4">
                                <AlertCircle className="w-6 h-6 mr-2 opacity-80" />
                                <h3 className="font-bold text-lg">Note Importante</h3>
                            </div>
                            <p className="text-blue-100 text-sm">
                                Ces analyses sont générées par des algorithmes d'apprentissage automatique basés sur vos données historiques. Elles s'affineront avec le temps pour vous offrir des prévisions plus précises.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
