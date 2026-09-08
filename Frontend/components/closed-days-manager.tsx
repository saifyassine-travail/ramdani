"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiClient, type ClosedDay, type ImpactedAppointment } from "@/lib/api"
import { formatName } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarOff, Phone, Loader2, X, AlertTriangle, CalendarCheck } from "lucide-react"

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const DOW = ["L", "M", "M", "J", "V", "S", "D"]

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[m - 1].toLowerCase()} ${y}`
}

/**
 * Jours de fermeture du cabinet.
 *
 * Fermer une journée qui contient déjà des rendez-vous n'annule rien : la liste
 * des patients concernés s'ouvre avec leur téléphone, pour que le cabinet les
 * appelle et convienne d'une autre date. Supprimer à leur place ferait
 * disparaître un rendez-vous sans que personne ne soit prévenu.
 */
export default function ClosedDaysManager() {
  const { toast } = useToast()
  const [month, setMonth] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1) })
  const [closed, setClosed] = useState<Record<string, ClosedDay>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // Journée en cours de fermeture, avec les patients à rappeler.
  const [impact, setImpact] = useState<{
    date: string
    reason: string
    appointments: ImpactedAppointment[]
    confirmed: boolean
  } | null>(null)
  const [called, setCalled] = useState<Record<number, boolean>>({})

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = ymd(new Date(month.getFullYear(), month.getMonth() - 1, 1))
      const to = ymd(new Date(month.getFullYear(), month.getMonth() + 2, 0))
      const days = await apiClient.getClosedDays(from, to)
      setClosed(Object.fromEntries(days.map((d) => [d.date, d])))
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    // Semaine commençant le lundi.
    const shift = (first.getDay() + 6) % 7
    const start = addDays(first, -shift)
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i)
      return {
        date: d,
        ds: ymd(d),
        inMonth: d.getMonth() === month.getMonth(),
        past: d < today,
      }
    })
  }, [month, today])

  /** Étape 1 : on regarde qui est programmé avant de fermer quoi que ce soit. */
  const askClose = async (ds: string) => {
    setBusy(ds)
    try {
      const r = await apiClient.getClosedDayImpact(ds)
      setCalled({})
      setImpact({ date: ds, reason: "", appointments: r.appointments, confirmed: false })
    } finally {
      setBusy(null)
    }
  }

  /** Étape 2 : fermeture effective. Les rendez-vous existants restent en place. */
  const confirmClose = async () => {
    if (!impact) return
    setBusy(impact.date)
    try {
      const r = await apiClient.closeDay(impact.date, impact.reason.trim() || undefined)
      if (!r.success) {
        toast({ variant: "destructive", title: "Fermeture impossible", description: r.message })
        return
      }
      await load()
      if (r.pending_count > 0) {
        // On garde la fenêtre ouverte : le travail d'appel commence maintenant.
        setImpact({ ...impact, appointments: r.appointments, confirmed: true })
        toast({
          title: "Journée fermée",
          description: `${r.pending_count} patient(s) à rappeler pour convenir d'une autre date.`,
        })
      } else {
        setImpact(null)
        toast({ title: "Journée fermée", description: longDate(impact.date) })
      }
    } finally {
      setBusy(null)
    }
  }

  const reopen = async (ds: string) => {
    setBusy(ds)
    try {
      const r = await apiClient.reopenDay(ds)
      if (r.success) {
        await load()
        toast({ title: "Journée rouverte", description: longDate(ds) })
      } else {
        toast({ variant: "destructive", title: "Action impossible", description: r.message })
      }
    } finally {
      setBusy(null)
    }
  }

  const upcoming = useMemo(
    () => Object.values(closed).filter((d) => d.date >= ymd(today)).sort((a, b) => a.date.localeCompare(b.date)),
    [closed, today],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOff className="h-5 w-5 text-rose-600" />
          Jours de fermeture
        </CardTitle>
        <CardDescription>
          Marquez vos congés et absences. Le personnel ne pourra plus y programmer de rendez-vous.
          Les rendez-vous déjà pris ne sont jamais supprimés : vous obtenez la liste des patients à rappeler.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Calendrier */}
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="outline" size="sm"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</Button>
            <span className="text-sm font-semibold text-gray-900">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </span>
            <Button variant="outline" size="sm"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</Button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {DOW.map((d, i) => (
              <div key={i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {grid.map((c) => {
                const cd = closed[c.ds]
                const isClosed = !!cd
                const working = busy === c.ds
                return (
                  <button
                    key={c.ds}
                    disabled={c.past || working}
                    onClick={() => (isClosed ? reopen(c.ds) : askClose(c.ds))}
                    title={
                      c.past ? "Date passée"
                        : isClosed ? `Fermé${cd.reason ? " — " + cd.reason : ""} · cliquer pour rouvrir`
                        : "Cliquer pour fermer cette journée"
                    }
                    className={`relative flex h-11 flex-col items-center justify-center rounded-lg border text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      isClosed
                        ? "border-rose-300 bg-rose-50 font-bold text-rose-700 hover:bg-rose-100"
                        : c.inMonth
                        ? "border-gray-200 bg-white text-gray-800 hover:border-rose-300 hover:bg-rose-50/50"
                        : "border-transparent bg-gray-50 text-gray-300"
                    }`}
                  >
                    {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.date.getDate()}
                    {isClosed && (cd.pending ?? 0) > 0 && (
                      <span
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white"
                        title={`${cd.pending} rendez-vous à replanifier`}
                      >
                        {cd.pending}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Prochaines fermetures */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-400">
            Fermetures à venir
          </h4>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 p-3 text-[13px] text-gray-500">
              Aucune fermeture programmée.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.map((d) => (
                <li key={d.date} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <CalendarOff className="h-4 w-4 flex-none text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-gray-900">{longDate(d.date)}</div>
                    {d.reason && <div className="text-[12px] text-gray-500">{d.reason}</div>}
                  </div>
                  {(d.pending ?? 0) > 0 && (
                    <button
                      onClick={() => askClose(d.date)}
                      className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {d.pending} à rappeler
                    </button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => reopen(d.date)} title="Rouvrir">
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      {/* Confirmation + liste d'appel */}
      <Dialog open={!!impact} onOpenChange={(o) => !o && setImpact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {impact?.confirmed ? (
                <><CalendarCheck className="h-5 w-5 text-rose-600" /> Patients à rappeler</>
              ) : (
                <><CalendarOff className="h-5 w-5 text-rose-600" /> Fermer le {impact && longDate(impact.date)}</>
              )}
            </DialogTitle>
          </DialogHeader>

          {impact && (
            <div className="space-y-4">
              {!impact.confirmed && (
                <div>
                  <Label className="text-xs text-gray-500">Motif (facultatif)</Label>
                  <Input
                    value={impact.reason}
                    onChange={(e) => setImpact({ ...impact, reason: e.target.value })}
                    placeholder="Congé, formation, jour férié…"
                    className="mt-1"
                  />
                </div>
              )}

              {impact.appointments.length === 0 ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-600">
                  Aucun rendez-vous n'est programmé ce jour-là.
                </p>
              ) : (
                <div>
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                    <p className="text-[12.5px] text-amber-900">
                      <b>{impact.appointments.length} rendez-vous</b> sont déjà pris ce jour-là.
                      Ils ne seront pas supprimés — appelez chaque patient pour convenir d'une autre date,
                      puis modifiez son rendez-vous.
                    </p>
                  </div>

                  <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                    {impact.appointments.map((a) => (
                      <li
                        key={a.ID_RV}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                          called[a.ID_RV] ? "border-emerald-200 bg-emerald-50" : "border-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!called[a.ID_RV]}
                          onChange={(e) => setCalled({ ...called, [a.ID_RV]: e.target.checked })}
                          className="h-4 w-4 flex-none accent-emerald-600"
                          title="Marquer comme appelé"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-gray-900">
                            {formatName(a.patient.first_name, a.patient.last_name)}
                          </div>
                          <div className="text-[11.5px] text-gray-500">
                            {a.type} · {a.status}
                          </div>
                        </div>
                        {a.patient.phone_num ? (
                          <a
                            href={`tel:${a.patient.phone_num}`}
                            className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 font-mono text-[12px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <Phone className="h-3 w-3" />
                            {a.patient.phone_num}
                          </a>
                        ) : (
                          <span className="text-[11.5px] italic text-gray-400">pas de téléphone</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                {impact.confirmed ? (
                  <Button className="flex-1" onClick={() => setImpact(null)}>Terminé</Button>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setImpact(null)}>
                      Annuler
                    </Button>
                    <Button
                      className="flex-1 bg-rose-600 hover:bg-rose-700"
                      onClick={confirmClose}
                      disabled={busy === impact.date}
                    >
                      {busy === impact.date ? "Fermeture…" : "Fermer la journée"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
