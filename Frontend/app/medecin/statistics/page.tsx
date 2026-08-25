"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { apiClient } from "@/lib/api"
import { Loader2, TrendingUp, Users, Calendar, Activity, Zap, AlertCircle, DollarSign, BarChart3, Database, FileSpreadsheet, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, Search, ListFilter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatGlobalDate } from "@/lib/format-date"

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

interface AppointmentDetailRow {
    ID_RV: number
    appointment_date: string
    type: string
    status: string
    diagnostic: string | null
    payement: number | null
    credit: number | null
    patient_id: number
    patient_first_name: string
    patient_last_name: string
}

// Same enum values as the appointments table's `status` column (matches how
// AppointmentController/edit-appointment-modal already present them).
const STATUS_OPTIONS = ["Programmé", "Salle dattente", "En préparation", "En consultation", "Terminé", "Annulé"]

// Same raw type values stored in DB ("Control"), labeled the way
// components/edit-appointment-modal.tsx already presents them ("Contrôle").
const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "Consultation", label: "Consultation" },
    { value: "Control", label: "Contrôle" },
]

type AppointmentSortField = "appointment_date" | "payement" | "credit" | "patient_name"

export default function StatisticsPage() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<StatsData | null>(null)
    const [exporting, setExporting] = useState<"db" | "csv" | null>(null)

    const handleExport = async (format: "db" | "csv") => {
        setExporting(format)
        try {
            const result = await apiClient.exportDatabase(format)
            if (result.canceled) return
            if (result.success) {
                toast({
                    title: "Sauvegarde réussie",
                    description:
                        format === "db"
                            ? "La base de données (.db) a été enregistrée."
                            : "L'archive CSV (.zip) a été enregistrée.",
                })
            } else {
                toast({
                    variant: "destructive",
                    title: "Échec de la sauvegarde",
                    description: result.message || "Une erreur est survenue.",
                })
            }
        } finally {
            setExporting(null)
        }
    }

    // Chart Filter States
    const [viewMode, setViewMode] = useState<'year' | 'month'>('year')
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
    const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString())
    const [availableYears, setAvailableYears] = useState<number[]>([])

    const [chartData, setChartData] = useState<Array<{ date: string; count: number; revenue: number; credit: number }>>([])
    const [chartLoading, setChartLoading] = useState(false)

    // Appointments detail table: filters, sort, pagination
    const [detailRows, setDetailRows] = useState<AppointmentDetailRow[]>([])
    const [detailLoading, setDetailLoading] = useState(true)
    const [detailTotal, setDetailTotal] = useState(0)
    const [detailPage, setDetailPage] = useState(1)
    const [detailLastPage, setDetailLastPage] = useState(1)
    const [detailPerPage] = useState(25)

    const [detailDateFrom, setDetailDateFrom] = useState("")
    const [detailDateTo, setDetailDateTo] = useState("")
    const [detailStatus, setDetailStatus] = useState("all")
    const [detailType, setDetailType] = useState("all")
    const [detailSearchInput, setDetailSearchInput] = useState("")
    const [detailSearch, setDetailSearch] = useState("")
    const [detailSortBy, setDetailSortBy] = useState<AppointmentSortField>("appointment_date")
    const [detailSortDir, setDetailSortDir] = useState<"asc" | "desc">("desc")

    const detailSearchDebounce = useRef<NodeJS.Timeout>()
    useEffect(() => {
        if (detailSearchDebounce.current) clearTimeout(detailSearchDebounce.current)
        detailSearchDebounce.current = setTimeout(() => setDetailSearch(detailSearchInput), 300)
        return () => {
            if (detailSearchDebounce.current) clearTimeout(detailSearchDebounce.current)
        }
    }, [detailSearchInput])

    const fetchDetailRows = useCallback(
        async (page = 1) => {
            setDetailLoading(true)
            try {
                const response = await apiClient.getAppointmentsDetail({
                    date_from: detailDateFrom || undefined,
                    date_to: detailDateTo || undefined,
                    status: detailStatus !== "all" ? detailStatus : undefined,
                    type: detailType !== "all" ? detailType : undefined,
                    search: detailSearch || undefined,
                    sort_by: detailSortBy,
                    sort_dir: detailSortDir,
                    page,
                    per_page: detailPerPage,
                })

                if (response.success && response.data?.data) {
                    const paginator = response.data.data
                    setDetailRows(paginator.data || [])
                    setDetailTotal(paginator.total || 0)
                    setDetailPage(paginator.current_page || 1)
                    setDetailLastPage(paginator.last_page || 1)
                } else {
                    setDetailRows([])
                    setDetailTotal(0)
                }
            } catch (error) {
                console.error("Error fetching appointments detail:", error)
                setDetailRows([])
            } finally {
                setDetailLoading(false)
            }
        },
        [detailDateFrom, detailDateTo, detailStatus, detailType, detailSearch, detailSortBy, detailSortDir, detailPerPage],
    )

    useEffect(() => {
        fetchDetailRows(1)
    }, [fetchDetailRows])

    const toggleDetailSort = (field: AppointmentSortField) => {
        if (detailSortBy === field) {
            setDetailSortDir((d) => (d === "asc" ? "desc" : "asc"))
        } else {
            setDetailSortBy(field)
            setDetailSortDir("desc")
        }
    }

    const DetailSortIcon = ({ field }: { field: AppointmentSortField }) => {
        if (detailSortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
        return detailSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
    }

    const hasDetailFilters =
        detailDateFrom !== "" || detailDateTo !== "" || detailStatus !== "all" || detailType !== "all" || detailSearch !== ""

    const clearDetailFilters = () => {
        setDetailDateFrom("")
        setDetailDateTo("")
        setDetailStatus("all")
        setDetailType("all")
        setDetailSearchInput("")
        setDetailSearch("")
    }

    const statusBadgeClass = (status: string) => {
        switch (status) {
            case "Terminé":
                return "bg-green-100 text-green-700 border-green-200"
            case "Annulé":
                return "bg-red-100 text-red-700 border-red-200"
            case "En consultation":
                return "bg-blue-100 text-blue-700 border-blue-200"
            case "En préparation":
                return "bg-purple-100 text-purple-700 border-purple-200"
            case "Salle dattente":
                return "bg-amber-100 text-amber-700 border-amber-200"
            default:
                return "bg-gray-100 text-gray-700 border-gray-200"
        }
    }

    const typeLabel = (type: string) => TYPE_OPTIONS.find((t) => t.value === type)?.label || type

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
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Tableau de Bord IA & Statistiques</h1>
                    <p className="text-gray-500 mt-2">Vue d'overview de votre activité et insights prédictifs</p>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={exporting !== null}>
                            {exporting !== null ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Database className="h-4 w-4" />
                            )}
                            Sauvegarder la base
                            <ChevronDown className="h-4 w-4 opacity-70" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Choisir le format</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            disabled={exporting !== null}
                            onClick={() => handleExport("db")}
                        >
                            <Database className="h-4 w-4 text-blue-600" />
                            <div className="flex flex-col">
                                <span className="font-medium">Base de données (.db)</span>
                                <span className="text-xs text-gray-500">Fichier SQLite, toutes les tables</span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            disabled={exporting !== null}
                            onClick={() => handleExport("csv")}
                        >
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                            <div className="flex flex-col">
                                <span className="font-medium">Fichiers CSV (.zip)</span>
                                <span className="text-xs text-gray-500">Un CSV par table, dans une archive</span>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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

            {/* Detail table: individual appointments, filterable/sortable/paginated */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListFilter className="w-5 h-5 text-blue-600" />
                        Détail des Rendez-vous
                    </CardTitle>
                    <CardDescription>
                        Liste complète et filtrable des rendez-vous ({detailTotal} au total)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-4 rounded-lg border">
                        <div className="w-40">
                            <Label className="text-xs text-gray-500">Du</Label>
                            <Input
                                type="date"
                                value={detailDateFrom}
                                onChange={(e) => setDetailDateFrom(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="w-40">
                            <Label className="text-xs text-gray-500">Au</Label>
                            <Input
                                type="date"
                                value={detailDateTo}
                                onChange={(e) => setDetailDateTo(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="w-44">
                            <Label className="text-xs text-gray-500">Statut</Label>
                            <Select value={detailStatus} onValueChange={setDetailStatus}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Tous" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous</SelectItem>
                                    {STATUS_OPTIONS.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-40">
                            <Label className="text-xs text-gray-500">Type</Label>
                            <Select value={detailType} onValueChange={setDetailType}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Tous" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous</SelectItem>
                                    {TYPE_OPTIONS.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative flex-1 min-w-[200px]">
                            <Label className="text-xs text-gray-500">Patient</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Rechercher un patient..."
                                    value={detailSearchInput}
                                    onChange={(e) => setDetailSearchInput(e.target.value)}
                                    className="h-9 pl-9"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        {hasDetailFilters && (
                            <Button variant="ghost" size="sm" onClick={clearDetailFilters} className="h-9 text-gray-500 gap-1">
                                <X className="h-3.5 w-3.5" />
                                Réinitialiser
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead
                                        className="cursor-pointer select-none hover:text-gray-900"
                                        onClick={() => toggleDetailSort("appointment_date")}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Date
                                            <DetailSortIcon field="appointment_date" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer select-none hover:text-gray-900"
                                        onClick={() => toggleDetailSort("patient_name")}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            Patient
                                            <DetailSortIcon field="patient_name" />
                                        </span>
                                    </TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead>Diagnostic</TableHead>
                                    <TableHead
                                        className="cursor-pointer select-none hover:text-gray-900 text-right"
                                        onClick={() => toggleDetailSort("payement")}
                                    >
                                        <span className="inline-flex items-center gap-1 justify-end">
                                            Paiement
                                            <DetailSortIcon field="payement" />
                                        </span>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer select-none hover:text-gray-900 text-right"
                                        onClick={() => toggleDetailSort("credit")}
                                    >
                                        <span className="inline-flex items-center gap-1 justify-end">
                                            Crédit
                                            <DetailSortIcon field="credit" />
                                        </span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : detailRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                                            Aucun rendez-vous trouvé pour ces filtres
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    detailRows.map((row) => (
                                        <TableRow key={row.ID_RV}>
                                            <TableCell className="whitespace-nowrap">{formatGlobalDate(row.appointment_date)}</TableCell>
                                            <TableCell className="whitespace-nowrap font-medium text-gray-900">
                                                {row.patient_first_name} {row.patient_last_name}
                                            </TableCell>
                                            <TableCell>{typeLabel(row.type)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusBadgeClass(row.status)}>
                                                    {row.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate text-gray-600">
                                                {row.diagnostic || "—"}
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                                {row.payement ?? 0} DH
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap">
                                                <span className={row.credit ? "text-red-600 font-medium" : "text-gray-500"}>
                                                    {row.credit ?? 0} DH
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {detailLastPage > 1 && (
                        <div className="flex items-center justify-between px-1">
                            <div className="text-sm text-gray-700">
                                Affichage de {(detailPage - 1) * detailPerPage + 1} à{" "}
                                {Math.min(detailPage * detailPerPage, detailTotal)} sur {detailTotal} rendez-vous
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchDetailRows(detailPage - 1)}
                                    disabled={detailPage === 1 || detailLoading}
                                >
                                    Précédent
                                </Button>
                                <div className="flex items-center space-x-1">
                                    {Array.from({ length: Math.min(5, detailLastPage) }, (_, i) => {
                                        const page = i + 1
                                        return (
                                            <Button
                                                key={page}
                                                variant={detailPage === page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => fetchDetailRows(page)}
                                                disabled={detailLoading}
                                                className="w-8 h-8 p-0"
                                            >
                                                {page}
                                            </Button>
                                        )
                                    })}
                                    {detailLastPage > 5 && (
                                        <>
                                            <span className="text-gray-500">...</span>
                                            <Button
                                                variant={detailPage === detailLastPage ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => fetchDetailRows(detailLastPage)}
                                                disabled={detailLoading}
                                                className="w-8 h-8 p-0"
                                            >
                                                {detailLastPage}
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchDetailRows(detailPage + 1)}
                                    disabled={detailPage === detailLastPage || detailLoading}
                                >
                                    Suivant
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
