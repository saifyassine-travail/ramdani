"use client"

import React, { useEffect, useMemo, useState } from "react"
import { apiClient, type Appointment } from "@/lib/api"
import { formatName } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const NAV_BLUE = "#4361ee"
const NAV_BLUE_DARK = "#3a0ca3"
const NAV_BLUE_SOFT = "#eef1fe"
const NAV_BLUE_LINE = "#d7dffb"

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const DOW = ["D", "L", "M", "M", "J", "V", "S"]

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

interface Props {
  appointment: Appointment | null
  onClose: () => void
  /** Called after a successful move so the board can refresh. */
  onDone: (message: string, success: boolean) => void
}

/**
 * Right-click on a "Programmé" card → move that appointment to another day.
 * The backend only accepts dates from today onwards (`after_or_equal:today`),
 * so past days are disabled here rather than failing on submit.
 */
export default function RescheduleModal({ appointment, onClose, onDone }: Props) {
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const [month, setMonth] = useState(() => new Date())
  const [picked, setPicked] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!appointment) return
    const d = appointment.appointment_date ? new Date(appointment.appointment_date) : new Date()
    const base = isNaN(d.getTime()) ? new Date() : d
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    setPicked(null)
    setSaving(false)
  }, [appointment])

  useEffect(() => {
    if (!appointment) return
    const ym = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
    let alive = true
    apiClient.getMonthlyCounts(ym).then(r => {
      if (alive && r.success && r.data) setCounts(r.data as Record<string, number>)
    }).catch(() => {})
    return () => { alive = false }
  }, [month, appointment])

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = addDays(first, -first.getDay())
    return Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(d => ({
      ds: ymd(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month.getMonth(),
      past: d < today,
      n: counts[ymd(d)] || 0,
    }))
  }, [month, counts, today])

  const submit = async () => {
    if (!appointment || !picked || saving) return
    setSaving(true)
    try {
      const r = await apiClient.updateAppointment(appointment.ID_RV, { appointment_date: picked })
      if (r.success) {
        const [y, m, d] = picked.split("-").map(Number)
        onDone(`Rendez-vous déplacé au ${d} ${MONTHS[m - 1].toLowerCase()} ${y}`, true)
        onClose()
      } else {
        onDone(r.message || "Impossible de déplacer le rendez-vous", false)
        setSaving(false)
      }
    } catch {
      onDone("Erreur serveur", false)
      setSaving(false)
    }
  }

  const quick = [
    { label: "Demain", d: addDays(today, 1) },
    { label: "Dans 7 j", d: addDays(today, 7) },
    { label: "Dans 1 mois", d: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()) },
    { label: "Dans 3 mois", d: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()) },
  ]

  const dotColor = (n: number) => (n === 0 ? "#d1d5db" : n > 15 ? "#dc2626" : n > 8 ? "#ca8a04" : "#16a34a")

  return (
    <Dialog open={!!appointment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Reprogrammer le rendez-vous</DialogTitle>
        </DialogHeader>

        {appointment && (
          <>
            <div className="-mt-1 rounded-lg px-3 py-2" style={{ background: NAV_BLUE_SOFT }}>
              <div className="text-[13px] font-semibold" style={{ color: NAV_BLUE_DARK }}>
                {formatName(appointment.patient?.first_name || "", appointment.patient?.last_name || "")}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                {appointment.type} · actuellement le {appointment.appointment_date?.slice(0, 10)}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quick.map(q => (
                <button key={q.label} onClick={() => { setPicked(ymd(q.d)); setMonth(new Date(q.d.getFullYear(), q.d.getMonth(), 1)) }}
                  className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                  style={{
                    borderColor: picked === ymd(q.d) ? NAV_BLUE : NAV_BLUE_LINE,
                    background: picked === ymd(q.d) ? NAV_BLUE : "#fff",
                    color: picked === ymd(q.d) ? "#fff" : NAV_BLUE_DARK,
                  }}>{q.label}</button>
              ))}
            </div>

            <div className="rounded-xl border p-2.5" style={{ borderColor: NAV_BLUE_LINE }}>
              <div className="mb-2 flex items-center justify-between">
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="h-7 w-7 rounded-lg border text-gray-500" style={{ borderColor: NAV_BLUE_LINE }}>‹</button>
                <span className="text-[12.5px] font-semibold" style={{ color: NAV_BLUE_DARK }}>
                  {MONTHS[month.getMonth()]} {month.getFullYear()}
                </span>
                <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="h-7 w-7 rounded-lg border text-gray-500" style={{ borderColor: NAV_BLUE_LINE }}>›</button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {DOW.map((w, i) => <div key={i} className="py-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map(d => {
                  const on = picked === d.ds
                  return (
                    <button key={d.ds} disabled={d.past} onClick={() => setPicked(d.ds)}
                      className="flex h-[32px] flex-col items-center justify-center gap-[3px] rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                      style={{ background: on ? NAV_BLUE : "transparent" }}
                      onMouseEnter={e => { if (!on && !d.past) e.currentTarget.style.background = NAV_BLUE_SOFT }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent" }}>
                      <span className="text-[11.5px]" style={{ color: on ? "#fff" : d.inMonth ? "#111827" : "#c8cfd3", fontWeight: on ? 700 : d.inMonth ? 500 : 400 }}>{d.day}</span>
                      <span className="h-1 w-1 rounded-full" style={{ background: on ? "rgba(255,255,255,.85)" : !d.inMonth || !d.n ? "transparent" : dotColor(d.n) }} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border py-2 text-[12px] font-semibold text-gray-600" style={{ borderColor: "#e5e7eb" }}>
                Annuler
              </button>
              <button onClick={submit} disabled={!picked || saving}
                className="flex-1 rounded-lg py-2 text-[12px] font-bold text-white transition-opacity disabled:opacity-40"
                style={{ background: NAV_BLUE }}>
                {saving ? "Déplacement…" : "Déplacer"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
