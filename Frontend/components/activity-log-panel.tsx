"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"
import {
  Loader2,
  Search,
  History,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Users,
  Calendar,
  Pill,
  FlaskConical,
  Activity,
} from "lucide-react"

interface LogRow {
  id: number
  user_id: number | null
  user_name: string | null
  action: string
  description: string | null
  ip_address: string | null
  created_at: string
}

const ACTION_FILTERS = [
  { value: "all", label: "Toutes les actions" },
  { value: "auth", label: "Connexions" },
  { value: "patient", label: "Patients" },
  { value: "appointment", label: "Rendez-vous" },
  { value: "medicament", label: "Médicaments" },
  { value: "analysis", label: "Analyses" },
  { value: "user", label: "Utilisateurs" },
]

function actionIcon(action: string) {
  if (action.startsWith("auth")) return LogIn
  if (action.startsWith("patient")) return Users
  if (action.startsWith("appointment")) return Calendar
  if (action.startsWith("medicament")) return Pill
  if (action.startsWith("analysis")) return FlaskConical
  if (action.startsWith("user")) return UserIcon
  return Activity
}

function actionColor(action: string) {
  if (action.endsWith(".created") || action === "auth.login") return "bg-green-100 text-green-700"
  if (action.endsWith(".deleted") || action === "auth.logout") return "bg-red-100 text-red-700"
  if (action.endsWith(".updated")) return "bg-amber-100 text-amber-700"
  return "bg-blue-100 text-blue-700"
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ActivityLogPanel() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [action, setAction] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getActivityLogs({
        q: q || undefined,
        action: action !== "all" ? action : undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      })
      const data = res.data as any
      if (res.success && data) {
        setRows(Array.isArray(data.data) ? data.data : [])
        setLastPage(data.meta?.last_page ?? 1)
        setTotal(data.meta?.total ?? 0)
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [q, action, from, to, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1)
  }, [q, action, from, to])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <History className="w-5 h-5" />
          Journal d'activité
        </CardTitle>
        <p className="text-sm text-gray-500">Historique des opérations effectuées par chaque utilisateur.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Utilisateur, description..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_FILTERS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[160px_180px_1fr] bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
            <div>Date</div>
            <div>Utilisateur</div>
            <div>Action</div>
          </div>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">Aucune activité trouvée.</div>
          ) : (
            rows.map((row) => {
              const Icon = actionIcon(row.action)
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[160px_180px_1fr] items-center px-4 py-2.5 border-t text-sm hover:bg-gray-50"
                >
                  <div className="text-xs text-gray-500">{formatDateTime(row.created_at)}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-3 w-3 text-gray-500" />
                    </div>
                    <span className="truncate text-gray-700">{row.user_name || "Système"}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${actionColor(row.action)}`}>
                      <Icon className="h-3 w-3" />
                      {row.action}
                    </span>
                    <span className="truncate text-gray-700">{row.description}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} entrée{total > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs">
              Page {page} / {lastPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
