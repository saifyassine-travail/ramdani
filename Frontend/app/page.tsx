"use client"

import React from "react"
import { useState, useEffect, createContext, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAppointments } from "../hooks/use-appointments"
import { useCalendar } from "../hooks/use-calendar"
import { apiClient, Appointment } from "@/lib/api"
import { formatName } from "@/lib/utils"
import { useGlobalSync } from "@/hooks/use-global-sync"
import EditAppointmentModal from "@/components/edit-appointment-modal"
import QuickCaseModal from "@/components/quick-case-modal"
import PlanControlModal from "@/components/plan-control-modal"
import CompletedAppointmentModal from "@/components/completed-appointment-modal"
import RescheduleModal from "@/components/reschedule-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const AppContext = createContext<any>(null)

interface AppointmentsByStatus {
  scheduled: Appointment[]
  waiting: Appointment[]
  preparing: Appointment[]
  consulting: Appointment[]
  completed: Appointment[]
  canceled: Appointment[]
}
type Col = keyof AppointmentsByStatus
const STATUSES = ["scheduled", "waiting", "preparing", "consulting", "completed", "canceled"] as const
/** Statuses that hold a waiting-room ticket, in the order the queue flows. */
const FLOW: Col[] = ["waiting", "preparing", "consulting", "completed"]

const NAV_BLUE = "#4361ee"
const NAV_BLUE_DARK = "#3a0ca3"
const NAV_BLUE_SOFT = "#eef1fe"
const NAV_BLUE_LINE = "#d7dffb"

interface Palette { accent: string; tint: string; tintStrong: string; border: string; badgeBg: string; badgeFg: string }
const PAL: Record<Col, Palette> = {
  scheduled: { accent: "#64748b", tint: "#f6f7f9", tintStrong: "#eaedf1", border: "#e3e7ec", badgeBg: "#eef0f3", badgeFg: "#475569" },
  waiting:   { accent: "#ca8a04", tint: "#fefce8", tintStrong: "#fdf4c7", border: "#fae8a0", badgeBg: "#fef3c7", badgeFg: "#a16207" },
  preparing: { accent: "#ea580c", tint: "#fff7ed", tintStrong: "#ffedd5", border: "#fed7aa", badgeBg: "#ffedd5", badgeFg: "#c2410c" },
  consulting:{ accent: "#2563eb", tint: "#eff6ff", tintStrong: "#dbeafe", border: "#bfdbfe", badgeBg: "#dbeafe", badgeFg: "#1d4ed8" },
  completed: { accent: "#16a34a", tint: "#f0fdf4", tintStrong: "#dcfce7", border: "#bbf7d0", badgeBg: "#dcfce7", badgeFg: "#15803d" },
  canceled:  { accent: "#dc2626", tint: "#fef2f2", tintStrong: "#fee2e2", border: "#fecaca", badgeBg: "#fee2e2", badgeFg: "#b91c1c" },
}

const CAP: Partial<Record<Col, number>> = { preparing: 1, consulting: 1 }
const TITLES: Record<Col, string> = {
  scheduled: "Programmé", waiting: "Salle d'attente", preparing: "En préparation",
  consulting: "En consultation", completed: "Terminé", canceled: "Annulé",
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const DOW = ["D", "L", "M", "M", "J", "V", "S"]

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) }
const fmtTime = (raw?: string | null) => {
  if (!raw) return "--:--"
  const m = String(raw).match(/(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`
  const d = new Date(raw)
  return isNaN(d.getTime()) ? "--:--" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
const ageOf = (b?: string | null) => {
  if (!b) return null
  const d = new Date(b)
  return isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 3.15576e10)
}
const elapsedOf = (s?: string | null) => {
  if (!s) return null
  const t = new Date(s).getTime()
  if (isNaN(t)) return null
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}`
}
/** Queue order: ticket number first, then scheduled time for anyone without one. */
const byQueue = (a: Appointment, b: Appointment) => {
  const qa = a.queue_number ?? Number.MAX_SAFE_INTEGER
  const qb = b.queue_number ?? Number.MAX_SAFE_INTEGER
  if (qa !== qb) return qa - qb
  return String(a.start_time || "").localeCompare(String(b.start_time || ""))
}

const D_EDIT = "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
const D_EYE = "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
const D_TRASH = "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"

const IconBtn = ({ onClick, title, d, danger }: { onClick: (e: React.MouseEvent) => void; title: string; d: string; danger?: boolean }) => (
  <button onClick={onClick} title={title}
    className={`flex h-[22px] w-[22px] items-center justify-center rounded-md text-gray-400 transition-colors ${danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-gray-100 hover:text-gray-700"}`}>
    <svg className="h-[13px] w-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>
  </button>
)

const Dashboard = () => {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(ymd(new Date()))
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dayDir, setDayDir] = useState<1 | -1>(1)
  const [leaving, setLeaving] = useState(false)
  const [stripDir, setStripDir] = useState<1 | -1>(1)
  const selectedDateRef = useRef(selectedDate)
  useEffect(() => { selectedDateRef.current = selectedDate }, [selectedDate])

  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<number | null>(null)
  const [confirmingAppointment, setConfirmingAppointment] = useState<{ id: number; source: string; target: string } | null>(null)

  const [contextMenuApt, setContextMenuApt] = useState<Appointment | null>(null)
  const [controlApt, setControlApt] = useState<Appointment | null>(null)
  const [completedApt, setCompletedApt] = useState<Appointment | null>(null)
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null)

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [rejectCol, setRejectCol] = useState<string | null>(null)
  const [landedCol, setLandedCol] = useState<string | null>(null)
  const fxTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const [localData, setLocalData] = useState<AppointmentsByStatus>({
    scheduled: [], waiting: [], preparing: [], consulting: [], completed: [], canceled: [],
  })
  const localDataRef = useRef<AppointmentsByStatus>(localData)
  useEffect(() => { localDataRef.current = localData }, [localData])

  const {
    appointments: serverData, loading, error,
    updateAppointmentStatus, toggleMutuelle, deleteAppointment, refetch,
  } = useAppointments(selectedDate)

  const { currentDate, appointmentCounts, navigateMonth, refetch: refetchCounts } = useCalendar()

  const [booted, setBooted] = useState(false)
  useEffect(() => { if (!loading) setBooted(true) }, [loading])
  const switching = booted && loading

  const lastServerDataRef = useRef<string>("")
  useEffect(() => {
    if (!serverData) return
    const s = JSON.stringify(serverData)
    if (s === lastServerDataRef.current) return
    lastServerDataRef.current = s
    setLocalData({
      scheduled: [...(serverData.scheduled || [])].sort(byQueue),
      waiting: [...(serverData.waiting || [])].sort(byQueue),
      preparing: [...(serverData.preparing || [])].sort(byQueue),
      consulting: [...(serverData.consulting || [])].sort(byQueue),
      completed: [...(serverData.completed || [])].sort(byQueue),
      canceled: [...(serverData.canceled || [])].sort(byQueue),
    })
  }, [serverData])

  // Warm the neighbouring days so ‹ / › and strip clicks feel instant.
  useEffect(() => {
    const base = parseYmd(selectedDate)
    const t = setTimeout(() => {
      for (const off of [1, -1, 2, -2, 3, -3]) {
        apiClient.getAppointments(ymd(addDays(base, off))).catch(() => {})
      }
    }, 300)
    return () => clearTimeout(t)
  }, [selectedDate])

  const dragStateRef = useRef({ appointmentId: null as number | null, sourceStatus: null as string | null, isDragging: false })

  const showNotification = useCallback((message: string, type: "success" | "error") => {
    setToast({ msg: message, type })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const flashColumn = useCallback((colId: string, kind: "reject" | "land") => {
    if (fxTimerRef.current) clearTimeout(fxTimerRef.current)
    if (kind === "reject") setRejectCol(colId)
    else setLandedCol(colId)
    fxTimerRef.current = setTimeout(() => { setRejectCol(null); setLandedCol(null) }, 550)
  }, [])

  /** Persist the whole day's ticket order, 1..N, following the on-screen order. */
  const persistQueue = useCallback((data: AppointmentsByStatus) => {
    const ids = FLOW.flatMap(s => data[s].map(a => a.ID_RV))
    if (ids.length === 0) return
    apiClient.reorderQueue(ids).catch(err => console.error("reorder failed", err))
  }, [])

  const moveLocal = useCallback((id: number, from: string, to: string) => {
    setLocalData(prev => {
      const fromList = prev[from as Col] || []
      const idx = fromList.findIndex(a => a.ID_RV === id)
      if (idx === -1) return prev
      const item = fromList[idx]
      const toList = [...(prev[to as Col] || []), { ...item, status: to }]
      return { ...prev, [from]: fromList.filter((_, i) => i !== idx), [to]: toList.sort(byQueue) }
    })
  }, [])

  const deleteLocal = useCallback((id: number) => {
    setLocalData(prev => {
      const n = { ...prev }
      for (const s of STATUSES) n[s] = prev[s].filter(a => a.ID_RV !== id)
      return n
    })
  }, [])

  /** Drop a card onto another card in the same column → new queue position. */
  const reorderWithin = useCallback((col: Col, dragId: number, dropBeforeId: number) => {
    setLocalData(prev => {
      const list = [...prev[col]]
      const from = list.findIndex(a => a.ID_RV === dragId)
      const to = list.findIndex(a => a.ID_RV === dropBeforeId)
      if (from === -1 || to === -1 || from === to) return prev
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      // Renumber this column's tickets in place using the numbers it already
      // owns, so the queue stays 1..N for the day without touching other columns.
      const tickets = prev[col].map(a => a.queue_number).filter((n): n is number => n != null).sort((a, b) => a - b)
      const renumbered = list.map((a, i) => (tickets[i] != null ? { ...a, queue_number: tickets[i] } : a))
      const next = { ...prev, [col]: renumbered }
      persistQueue(next)
      return next
    })
  }, [persistQueue])

  // ── Drag & drop ─────────────────────────────────────────────────────
  // Hover feedback is painted straight to the DOM (no React state per
  // dragover event) so a 40-card board stays at 60fps while dragging.
  const overColRef = useRef<string | null>(null)
  const overCardRef = useRef<number | null>(null)

  const paintOver = useCallback((nextCol: string | null, nextCard: number | null) => {
    if (overColRef.current !== nextCol) {
      overColRef.current = nextCol
      document.querySelectorAll<HTMLElement>("[data-status]").forEach(el => {
        const s = el.getAttribute("data-status") as Col
        const p = PAL[s]
        const hot = s === nextCol
        el.style.background = hot ? p.tintStrong : p.tint
        el.style.borderColor = hot ? p.accent : p.border
        const badge = el.querySelector<HTMLElement>("[data-badge]")
        if (badge) {
          badge.style.background = hot ? p.accent : p.badgeBg
          badge.style.color = hot ? "#fff" : p.badgeFg
        }
        const ph = el.querySelector<HTMLElement>("[data-placeholder]")
        if (ph) {
          ph.style.color = hot ? p.accent : "#9ca3af"
          ph.style.borderColor = hot ? p.accent : p.border
          ph.textContent = hot ? "Déposer ici" : (ph.dataset.placeholder || "")
        }
      })
    }
    if (overCardRef.current !== nextCard) {
      overCardRef.current = nextCard
      document.querySelectorAll<HTMLElement>("[data-appointment-id]").forEach(el => {
        const isTarget = Number(el.getAttribute("data-appointment-id")) === nextCard
        el.style.marginTop = isTarget ? "16px" : ""
        el.style.boxShadow = isTarget ? "0 -3px 0 -1px currentColor" : ""
      })
    }
  }, [])

  useEffect(() => {
    const resetCards = () => {
      document.querySelectorAll<HTMLElement>("[data-appointment-id]").forEach(el => {
        el.style.opacity = "1"; el.style.marginTop = ""; el.style.boxShadow = ""
      })
    }

    const onStart = (e: DragEvent) => {
      const card = (e.target as HTMLElement).closest("[data-appointment-id]") as HTMLElement
      if (!card) { e.preventDefault(); return }
      const id = card.getAttribute("data-appointment-id")
      const status = card.closest("[data-status]")?.getAttribute("data-status")
      if (!id || !status) { e.preventDefault(); return }
      dragStateRef.current = { appointmentId: Number(id), sourceStatus: status, isDragging: true }
      e.dataTransfer?.setData("text/plain", id)
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
      requestAnimationFrame(() => { card.style.opacity = "0.35" })
    }
    const onEnd = () => { resetCards(); paintOver(null, null); dragStateRef.current.isDragging = false }
    const onOver = (e: DragEvent) => {
      if (!dragStateRef.current.isDragging) return
      e.preventDefault()
      const t = e.target as HTMLElement
      const col = t.closest("[data-status]")?.getAttribute("data-status") || null
      const cardEl = t.closest("[data-appointment-id]")
      const cardId = cardEl ? Number(cardEl.getAttribute("data-appointment-id")) : null
      const sameCol = col === dragStateRef.current.sourceStatus
      paintOver(col, sameCol && cardId !== dragStateRef.current.appointmentId ? cardId : null)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation()
      const dropCardEl = (e.target as HTMLElement).closest("[data-appointment-id]")
      const dropCardId = dropCardEl ? Number(dropCardEl.getAttribute("data-appointment-id")) : null
      resetCards(); paintOver(null, null)

      const { appointmentId, sourceStatus, isDragging } = dragStateRef.current
      if (!isDragging || !appointmentId || !sourceStatus) return
      const targetStatus = (e.target as HTMLElement).closest("[data-status]")?.getAttribute("data-status")
      dragStateRef.current = { appointmentId: null, sourceStatus: null, isDragging: false }
      if (!targetStatus) return

      // Same column → change the patient's position in the queue.
      if (sourceStatus === targetStatus) {
        if (dropCardId && dropCardId !== appointmentId) {
          reorderWithin(targetStatus as Col, appointmentId, dropCardId)
          showNotification("Ordre de passage mis à jour", "success")
        }
        return
      }

      const cap = CAP[targetStatus as Col]
      if (cap != null && (localDataRef.current[targetStatus as Col]?.length || 0) >= cap) {
        flashColumn(targetStatus, "reject")
        showNotification("Un seul patient à la fois à cette étape.", "error")
        return
      }

      if (targetStatus === "completed") {
        let apt: Appointment | null = null
        for (const s of STATUSES) {
          const f = localDataRef.current[s as Col]?.find(a => a.ID_RV === appointmentId)
          if (f) { apt = f; break }
        }
        const raw = apt as any
        const cd = raw?.case_description || raw?.caseDescription
        const emptyCd = !cd || (typeof cd === "object" && !Object.keys(cd).some(k => {
          if (["created_at", "updated_at", "id", "ID_RV", "ID_patient"].includes(k)) return false
          return cd[k] !== null && cd[k] !== undefined && cd[k] !== ""
        }))
        const noOther = !(apt?.diagnostic || (apt?.medicaments && (apt?.medicaments as any[]).length > 0))
        if (emptyCd && noOther) {
          setConfirmingAppointment({ id: appointmentId, source: sourceStatus, target: targetStatus })
          return
        }
      }

      moveLocal(appointmentId, sourceStatus, targetStatus)
      flashColumn(targetStatus, "land")
      try {
        const r: any = await updateAppointmentStatus(appointmentId, targetStatus)
        if (r.success) {
          // The backend hands out the ticket on the way into the queue —
          // pull it back so the number shows immediately.
          if (sourceStatus === "scheduled" && FLOW.includes(targetStatus as Col)) {
            refetch(selectedDateRef.current, true)
          }
          showNotification("Statut mis à jour", "success")
        } else {
          showNotification(r.message || "Erreur", "error")
          moveLocal(appointmentId, targetStatus, sourceStatus)
        }
      } catch (err) {
        console.error(err)
        showNotification("Erreur serveur", "error")
        moveLocal(appointmentId, targetStatus, sourceStatus)
      }
    }
    document.addEventListener("dragstart", onStart)
    document.addEventListener("dragend", onEnd)
    document.addEventListener("dragover", onOver)
    document.addEventListener("drop", onDrop)
    return () => {
      document.removeEventListener("dragstart", onStart)
      document.removeEventListener("dragend", onEnd)
      document.removeEventListener("dragover", onOver)
      document.removeEventListener("drop", onDrop)
    }
  }, [moveLocal, updateAppointmentStatus, showNotification, flashColumn, paintOver, reorderWithin, refetch])

  useEffect(() => {
    const h = () => refetch(selectedDateRef.current, true)
    window.addEventListener("appointmentCreated", h)
    return () => window.removeEventListener("appointmentCreated", h)
  }, [refetch])

  const onDateSync = useCallback((event: any) => {
    if (event?.data?.date) setSelectedDate(event.data.date)
  }, [])
  const { emit: emitDateChange } = useGlobalSync("date-select", { onEvent: onDateSync })

  // Day change is played in two beats: the current columns leave in the
  // direction of travel, then the new ones arrive from the other side. The
  // swap happens between the two, so the board never cross-fades over itself.
  const OUT_MS = 190
  const swapTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current) }, [])

  const handleDateSelect = useCallback((date: string) => {
    if (date === selectedDateRef.current) { setPickerOpen(false); return }
    const dir: 1 | -1 = date > selectedDateRef.current ? 1 : -1
    setDayDir(dir)
    setPickerOpen(false)
    setLeaving(true)
    if (swapTimer.current) clearTimeout(swapTimer.current)
    swapTimer.current = setTimeout(() => {
      setSelectedDate(date)
      setAnchorDate(parseYmd(date))
      setLeaving(false)
      emitDateChange({ date })
    }, OUT_MS)
  }, [emitDateChange])

  // Moving the week window animates the strip on its own, without touching
  // the board — the doctor is browsing dates, not changing the day yet.
  const shiftWeek = useCallback((days: number) => {
    setStripDir(days > 0 ? 1 : -1)
    setAnchorDate(a => addDays(a, days))
  }, [])

  const handleMutuelleToggle = useCallback(async (id: number) => {
    const r = await toggleMutuelle(id)
    if (r.success) showNotification("Mutuelle mise à jour", "success")
    else showNotification(r.message || "Erreur", "error")
  }, [toggleMutuelle, showNotification])

  const handleRightClick = useCallback((e: React.MouseEvent, apt: Appointment, status: string) => {
    if (status === "scheduled") { e.preventDefault(); setRescheduleApt(apt) }
    else if (status === "preparing") { e.preventDefault(); setContextMenuApt(apt) }
    else if (status === "completed") { e.preventDefault(); setCompletedApt(apt) }
  }, [])

  const handleControlResult = useCallback((success: boolean, message: string) => {
    showNotification(message, success ? "success" : "error")
    if (success) { setControlApt(null); refetch(selectedDateRef.current, true) }
  }, [showNotification, refetch])

  const handleDoubleClick = useCallback((apt: Appointment) => {
    router.push(`/appointments/${apt.ID_RV}`)
  }, [router])

  const findApt = useCallback((id: number) => {
    for (const s of STATUSES) {
      const a = localDataRef.current[s]?.find(x => x.ID_RV === id)
      if (a) return a
    }
    return null
  }, [])

  const handleConfirmDelete = async () => {
    if (!deletingAppointmentId) return
    const id = deletingAppointmentId
    setDeletingAppointmentId(null)
    deleteLocal(id)
    const r = await deleteAppointment(id)
    if (r.success) showNotification("Rendez-vous supprimé", "success")
    else { showNotification(r.message || "Erreur lors de la suppression", "error"); refetch(selectedDateRef.current, true) }
  }

  const handleConfirmStatusChange = async () => {
    if (!confirmingAppointment) return
    const { id, source, target } = confirmingAppointment
    setConfirmingAppointment(null)
    moveLocal(id, source, target)
    flashColumn(target, "land")
    try {
      const r = await updateAppointmentStatus(id, target)
      if (r.success) showNotification("Statut mis à jour", "success")
      else { showNotification(r.message || "Erreur", "error"); moveLocal(id, target, source) }
    } catch (err) {
      console.error(err)
      showNotification("Erreur serveur", "error")
      moveLocal(id, target, source)
    }
  }

  // ── derived ──────────────────────────────────────────────────────────
  const active = localData.scheduled.length + localData.waiting.length + localData.preparing.length + localData.consulting.length
  const cancelled = localData.canceled
  const summary = `${active} en cours · ${localData.completed.length} terminés · ${cancelled.length} annulé`

  const strip = useMemo(() =>
    Array.from({ length: 11 }, (_, i) => addDays(anchorDate, i - 5)).map(d => {
      const ds = ymd(d)
      return { ds, n: appointmentCounts[ds] || 0, day: d.getDate(), dow: DOW[d.getDay()], on: ds === selectedDate }
    }), [anchorDate, appointmentCounts, selectedDate])

  const pickerDays = useMemo(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const start = addDays(first, -first.getDay())
    return Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(d => {
      const ds = ymd(d)
      return { ds, day: d.getDate(), inMonth: d.getMonth() === currentDate.getMonth(), on: ds === selectedDate, n: appointmentCounts[ds] || 0 }
    })
  }, [currentDate, selectedDate, appointmentCounts])

  const selLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number)
    return `${d} ${MONTHS[m - 1].toLowerCase()} ${y}`
  }, [selectedDate])

  const dotColor = (n: number) => (n === 0 ? "#d1d5db" : n > 15 ? "#dc2626" : n > 8 ? "#ca8a04" : "#16a34a")

  const Ticket = ({ n, p, big }: { n?: number | null; p: Palette; big?: boolean }) => {
    if (n == null) return null
    return (
      <span className={`flex flex-none items-center justify-center rounded-md font-bold tabular-nums ${big ? "h-6 min-w-[26px] px-1.5 text-[13px]" : "h-[18px] min-w-[20px] px-1 text-[10.5px]"}`}
        style={{ background: p.accent, color: "#fff" }} title="Numéro d'ordre">{n}</span>
    )
  }

  // ── list card (Programmé / Salle d'attente / Terminé) ────────────────
  const renderCard = (apt: Appointment, col: Col) => {
    const p = PAL[col]
    const raw = apt as any
    return (
      <div
        key={apt.ID_RV}
        data-appointment-id={apt.ID_RV}
        draggable
        onContextMenu={(e) => handleRightClick(e, apt, col)}
        onDoubleClick={() => handleDoubleClick(apt)}
        className="group relative cursor-grab select-none rounded-lg border bg-white px-2.5 py-2 transition-[transform,box-shadow,margin] duration-150 will-change-transform active:cursor-grabbing hover:-translate-y-[2px] hover:shadow-[0_8px_18px_rgba(20,24,26,0.11)]"
        style={{ borderColor: p.border, color: p.accent }}
      >
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: p.accent }} />
        <div className="flex items-center gap-1.5 pl-1.5">
          <Ticket n={apt.queue_number} p={p} />
          <span className="font-mono text-[11.5px] font-semibold" style={{ color: p.accent }}>{fmtTime(raw.start_time)}</span>
          <span className="rounded border px-1.5 py-[1px] text-[9.5px] text-gray-500" style={{ borderColor: p.border }}>{apt.type}</span>
          {apt.mutuelle && <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} title="Mutuelle" />}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <IconBtn title="Modifier" d={D_EDIT} onClick={(e) => { e.stopPropagation(); setEditingAppointment(findApt(apt.ID_RV) || apt) }} />
            <IconBtn title="Fiche patient" d={D_EYE} onClick={(e) => { e.stopPropagation(); router.push(`/patients/${apt.ID_patient}`) }} />
            <IconBtn title="Supprimer" d={D_TRASH} danger onClick={(e) => { e.stopPropagation(); setDeletingAppointmentId(apt.ID_RV) }} />
          </div>
        </div>
        <div className="mt-1 truncate pl-1.5 text-[12.5px] font-medium text-gray-900">
          {formatName(raw.patient?.first_name || "", raw.patient?.last_name || "")}
        </div>
      </div>
    )
  }

  // ── active card (En préparation / En consultation) ───────────────────
  const renderActiveCard = (apt: Appointment, col: Col) => {
    const p = PAL[col]
    const raw = apt as any
    const pt = raw.patient || {}
    const cd = raw.case_description || raw.caseDescription
    const age = ageOf(pt.birth_day)
    const live = col === "consulting"
    void nowTick
    const elapsed = live ? elapsedOf(raw.consultation_started_at) : null

    const vitals: { l: string; v: string }[] = []
    if (cd && typeof cd === "object") {
      if (cd.blood_pressure) vitals.push({ l: "TA", v: String(cd.blood_pressure) })
      if (cd.pulse) vitals.push({ l: "Pouls", v: `${cd.pulse}` })
      if (cd.temperature) vitals.push({ l: "Temp.", v: `${cd.temperature}°` })
      if (cd.spo2) vitals.push({ l: "SpO₂", v: `${cd.spo2}%` })
      if (cd.weight) vitals.push({ l: "Poids", v: `${cd.weight} kg` })
      if (cd.tall) vitals.push({ l: "Taille", v: `${cd.tall} m` })
    }
    const flags: { t: string; bg: string; fg: string }[] = []
    if (pt.allergies) flags.push({ t: `Allergie · ${pt.allergies}`, bg: "#fef2f2", fg: "#b91c1c" })
    if (pt.chronic_conditions) flags.push({ t: pt.chronic_conditions, bg: "#fff7ed", fg: "#c2410c" })
    if (pt.blood_type) flags.push({ t: pt.blood_type, bg: "#f1f5f9", fg: "#475569" })

    return (
      <div
        key={apt.ID_RV}
        data-appointment-id={apt.ID_RV}
        draggable
        onContextMenu={(e) => handleRightClick(e, apt, col)}
        onDoubleClick={() => handleDoubleClick(apt)}
        className="group relative flex h-full cursor-grab select-none flex-col overflow-hidden rounded-xl border bg-white transition-shadow active:cursor-grabbing hover:shadow-[0_10px_24px_rgba(20,24,26,0.12)]"
        style={{ borderColor: p.border, color: p.accent }}
      >
        <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: p.accent }} />

        {/* header */}
        <div className="flex flex-none items-center gap-2 px-3 pt-2.5 pl-3.5">
          <Ticket n={apt.queue_number} p={p} big />
          <span className="font-mono text-[14px] font-bold" style={{ color: p.accent }}>{fmtTime(raw.start_time)}</span>
          {elapsed && (
            <span className="flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-bold" style={{ background: p.badgeBg, color: p.badgeFg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent, animation: "dc-dotPulse 1.2s ease-in-out infinite" }} />
              {elapsed}
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <IconBtn title="Modifier" d={D_EDIT} onClick={(e) => { e.stopPropagation(); setEditingAppointment(findApt(apt.ID_RV) || apt) }} />
            <IconBtn title="Fiche patient" d={D_EYE} onClick={(e) => { e.stopPropagation(); router.push(`/patients/${apt.ID_patient}`) }} />
            <IconBtn title="Supprimer" d={D_TRASH} danger onClick={(e) => { e.stopPropagation(); setDeletingAppointmentId(apt.ID_RV) }} />
          </div>
        </div>

        {/* identity */}
        <div className="flex-none px-3 pl-3.5 pt-1">
          <div className="truncate text-[17px] font-bold leading-tight text-gray-900">
            {formatName(pt.first_name || "", pt.last_name || "")}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-gray-500">
            <span className="rounded border px-1.5 py-[1px] font-medium" style={{ borderColor: p.border, color: p.accent }}>{apt.type}</span>
            {age != null && <span>{age} ans</span>}
            {pt.gender && <span>· {pt.gender === "Male" ? "H" : "F"}</span>}
            {pt.phone_num && <span>· {pt.phone_num}</span>}
            {apt.mutuelle && (
              <span onClick={(e) => { e.stopPropagation(); handleMutuelleToggle(apt.ID_RV) }}
                className="cursor-pointer rounded px-1.5 py-[1px] font-semibold" style={{ background: p.badgeBg, color: p.badgeFg }}>Mutuelle</span>
            )}
          </div>
        </div>

        {/* scrollable detail — fills whatever space is left */}
        <div className="dc-scroll min-h-0 flex-1 space-y-2 px-3 pb-2 pl-3.5 pt-2">
          {vitals.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {vitals.map(v => (
                <div key={v.l} className="rounded-lg px-2 py-1.5" style={{ background: p.tint }}>
                  <div className="text-[9.5px] font-medium uppercase tracking-[0.05em] text-gray-400">{v.l}</div>
                  <div className="text-[13.5px] font-bold leading-tight text-gray-800">{v.v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-2.5 py-2 text-[11.5px] text-gray-400" style={{ borderColor: p.border }}>
              Aucune constante saisie — clic droit pour remplir la fiche
            </div>
          )}

          {flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f, i) => (
                <span key={i} className="rounded-md px-2 py-[3px] text-[11px] font-semibold" style={{ background: f.bg, color: f.fg }}>{f.t}</span>
              ))}
            </div>
          )}

          {(cd?.case_description || apt.diagnostic) && (
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: p.tint }}>
              <div className="text-[9.5px] font-medium uppercase tracking-[0.05em] text-gray-400">
                {apt.diagnostic ? "Diagnostic" : "Motif"}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-gray-700">{apt.diagnostic || cd?.case_description}</div>
            </div>
          )}

          {cd?.notes && <div className="text-[11.5px] italic leading-snug text-gray-500">{cd.notes}</div>}
        </div>

        {/* footer action */}
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/appointments/${apt.ID_RV}`) }}
          className="flex flex-none items-center justify-center gap-1.5 border-t py-2 text-[12px] font-bold transition-colors"
          style={{ borderColor: p.border, background: p.tint, color: p.accent }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = p.tintStrong }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = p.tint }}
        >
          Ouvrir le dossier
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    )
  }

  const ColHeader = ({ col, count, cap }: { col: Col; count: number; cap?: number }) => {
    const p = PAL[col]
    return (
      <div className="flex flex-none items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: p.accent, animation: col === "consulting" && count ? "dc-dotPulse 1.6s ease-in-out infinite" : undefined }} />
        <span className="truncate text-[12px] font-semibold text-gray-900">{TITLES[col]}</span>
        <span data-badge className="ml-auto flex-none rounded-full px-2 py-[3px] text-[10px] font-bold"
          style={{ background: p.badgeBg, color: p.badgeFg }}>{cap ? `${count}/${cap}` : count}</span>
      </div>
    )
  }

  const Skeleton = () => (
    <div className="grid min-h-0 flex-1 grid-cols-4 gap-3">
      {[0, 1, 2, 3].map(c => (
        <div key={c} className="flex min-h-0 flex-col gap-2 rounded-2xl border-[1.5px] border-gray-100 bg-[#fafbfc] p-3">
          <div className="flex items-center gap-2">
            <div className="dc-skel h-[7px] w-[7px] rounded-full" />
            <div className="dc-skel h-3 w-24" />
            <div className="dc-skel ml-auto h-4 w-7 rounded-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-white px-2.5 py-2" style={{ opacity: 1 - i * 0.14 }}>
              <div className="flex items-center gap-1.5">
                <div className="dc-skel h-3 w-9" />
                <div className="dc-skel h-3 w-14 rounded" />
              </div>
              <div className="dc-skel mt-1.5 h-3.5 w-3/4" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  const listCol = (col: Col) => {
    const items = localData[col]
    const p = PAL[col]
    return (
      <div key={col} data-status={col}
        className="flex min-h-0 flex-col rounded-2xl border-[1.5px]"
        style={{
          background: p.tint, borderColor: p.border,
          animation: rejectCol === col ? "dc-shake .4s ease" : landedCol === col ? "dc-dropPop .5s cubic-bezier(.2,.9,.25,1)" : undefined,
        }}>
        <ColHeader col={col} count={items.length} />
        <div className="dc-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
          {items.length > 0 ? items.map(a => renderCard(a, col)) : (
            <div data-placeholder="Aucun rendez-vous"
              className="flex h-full items-center justify-center text-[11.5px] font-medium text-gray-400">Aucun rendez-vous</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-white px-5 pb-3 pt-3.5">
        {/* Title */}
        <div className="flex flex-none flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[18px] font-semibold tracking-[-0.015em] text-gray-900">Journée en cours</span>
            <span className="text-[12.5px] text-gray-500">{summary}</span>
          </div>
          <span className="text-[11.5px] text-gray-400">Glisser pour changer de statut · glisser sur une carte pour changer l'ordre · clic droit sur un RV programmé pour le reporter</span>
        </div>

        {/* Day strip */}
        <div className="mt-2.5 flex flex-none items-center gap-2">
          <button onClick={() => shiftWeek(-7)}
            className="h-[30px] w-[30px] flex-none rounded-lg border text-[13px] text-gray-500 transition-colors hover:text-[#4361ee]"
            style={{ borderColor: NAV_BLUE_LINE, background: "#fff" }}
            onMouseEnter={e => { e.currentTarget.style.background = NAV_BLUE_SOFT }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff" }}>‹</button>

          <div className="relative flex-none">
            <button onClick={() => setPickerOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg border px-3 py-[7px] text-[12px] font-semibold transition-colors"
              style={{ borderColor: pickerOpen ? NAV_BLUE : NAV_BLUE_LINE, background: pickerOpen ? NAV_BLUE_SOFT : "#fff", color: NAV_BLUE_DARK }}>
              {(() => { const [y, m] = selectedDate.split("-").map(Number); return `${MONTHS[m - 1]} ${y}` })()}
              <span style={{ color: NAV_BLUE }}>▾</span>
            </button>
            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} />
                <div className="absolute left-0 top-10 z-30 w-[286px] rounded-2xl border bg-white p-3 shadow-[0_18px_44px_rgba(67,97,238,0.18)]"
                  style={{ borderColor: NAV_BLUE_LINE, animation: "dc-cardIn .2s cubic-bezier(.2,.9,.25,1)" }}>
                  <div className="mb-2 flex items-center justify-between">
                    <button onClick={() => navigateMonth("prev")} className="h-7 w-7 rounded-lg border text-gray-500 hover:text-[#4361ee]" style={{ borderColor: NAV_BLUE_LINE }}>‹</button>
                    <span className="text-[12.5px] font-semibold" style={{ color: NAV_BLUE_DARK }}>{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                    <button onClick={() => navigateMonth("next")} className="h-7 w-7 rounded-lg border text-gray-500 hover:text-[#4361ee]" style={{ borderColor: NAV_BLUE_LINE }}>›</button>
                  </div>
                  <div className="mb-1 grid grid-cols-7 gap-0.5">
                    {DOW.map((w, i) => <div key={i} className="py-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">{w}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {pickerDays.map((d) => (
                      <button key={d.ds} onClick={() => handleDateSelect(d.ds)}
                        className="flex h-[32px] flex-col items-center justify-center gap-[3px] rounded-lg transition-colors"
                        style={{ background: d.on ? NAV_BLUE : "transparent" }}
                        onMouseEnter={e => { if (!d.on) e.currentTarget.style.background = NAV_BLUE_SOFT }}
                        onMouseLeave={e => { if (!d.on) e.currentTarget.style.background = "transparent" }}>
                        <span className="text-[11.5px]" style={{ color: d.on ? "#fff" : d.inMonth ? "#111827" : "#c8cfd3", fontWeight: d.on ? 700 : d.inMonth ? 500 : 400 }}>{d.day}</span>
                        <span className="h-1 w-1 rounded-full" style={{ background: d.on ? "rgba(255,255,255,.85)" : !d.inMonth || !d.n ? "transparent" : dotColor(d.n) }} />
                      </button>
                    ))}
                  </div>
                  <button onClick={() => handleDateSelect(ymd(new Date()))}
                    className="mt-2.5 w-full rounded-lg py-[7px] text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                    style={{ background: NAV_BLUE }}>Aujourd'hui</button>
                </div>
              </>
            )}
          </div>

          <div
            key={ymd(anchorDate)}
            className="dc-strip flex min-w-0 flex-1 gap-1.5"
            data-dir={String(stripDir)}
          >
            {strip.map((d) => (
              <button key={d.ds} onClick={() => handleDateSelect(d.ds)}
                className="min-w-0 flex-1 rounded-lg border py-1 text-center transition-all duration-300 ease-out hover:-translate-y-[2px]"
                style={{
                  background: d.on ? NAV_BLUE : "#fff",
                  borderColor: d.on ? NAV_BLUE : NAV_BLUE_LINE,
                  boxShadow: d.on ? "0 4px 12px rgba(67,97,238,.28)" : "none",
                  animation: d.on
                    ? "dc-daySelect .34s cubic-bezier(.2,1.1,.3,1), dc-dayHalo .6s ease-out"
                    : undefined,
                }}
                onMouseEnter={e => { if (!d.on) e.currentTarget.style.background = NAV_BLUE_SOFT }}
                onMouseLeave={e => { if (!d.on) e.currentTarget.style.background = "#fff" }}>
                <div className="text-[8.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: d.on ? "rgba(255,255,255,.85)" : "#9aa3b2" }}>{d.dow}</div>
                <div className="text-[13.5px] font-bold leading-[1.35]" style={{ color: d.on ? "#fff" : NAV_BLUE_DARK }}>{d.day}</div>
                <div className="text-[9px]" style={{ color: d.on ? "rgba(255,255,255,.85)" : "#9aa3b2" }}>{d.n ? `${d.n} RV` : "—"}</div>
              </button>
            ))}
          </div>

          <button onClick={() => shiftWeek(7)}
            className="h-[30px] w-[30px] flex-none rounded-lg border text-[13px] text-gray-500 transition-colors hover:text-[#4361ee]"
            style={{ borderColor: NAV_BLUE_LINE, background: "#fff" }}
            onMouseEnter={e => { e.currentTarget.style.background = NAV_BLUE_SOFT }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fff" }}>›</button>
          <button onClick={() => handleDateSelect(ymd(new Date()))}
            className="flex-none rounded-lg px-3 py-[7px] text-[12px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: NAV_BLUE }}>Aujourd'hui</button>
        </div>

        <div className="mt-1.5 flex flex-none items-center gap-2.5">
          <span className="text-[10.5px] text-gray-400">{selLabel}</span>
          <div className="h-[2px] flex-1 overflow-hidden rounded-full" style={{ background: switching ? NAV_BLUE_SOFT : "transparent" }}>
            {switching && <div className="h-full w-1/4 rounded-full" style={{ background: NAV_BLUE, animation: "dc-bar 1.1s cubic-bezier(.4,0,.2,1) infinite" }} />}
          </div>
        </div>

        {/* ── Board: 4 columns ─────────────────────────────────────────── */}
        {!booted ? (
          <div className="mt-2 flex min-h-0 flex-1 flex-col"><Skeleton /></div>
        ) : error && active === 0 ? (
          <div className="mt-2 flex min-h-0 flex-1 items-center justify-center text-[13px] text-red-600">{error}</div>
        ) : (
          <div
            key={leaving ? "leaving" : selectedDate}
            className="dc-day mt-2 grid min-h-0 flex-1 grid-cols-4 gap-3"
            data-dir={String(dayDir)}
            data-leaving={leaving ? "true" : "false"}
          >
            {listCol("scheduled")}
            {listCol("waiting")}

            {/* the in-room column: En préparation over En consultation */}
            <div className="flex min-h-0 flex-col gap-3">
              {(["preparing", "consulting"] as Col[]).map(col => {
                const items = localData[col]
                const p = PAL[col]
                return (
                  <div key={col} data-status={col}
                    className="flex min-h-0 flex-1 flex-col rounded-2xl border-[1.5px]"
                    style={{
                      background: p.tint, borderColor: p.border,
                      animation: rejectCol === col ? "dc-shake .4s ease" : landedCol === col ? "dc-dropPop .5s cubic-bezier(.2,.9,.25,1)" : undefined,
                    }}>
                    <ColHeader col={col} count={items.length} cap={1} />
                    <div className="min-h-0 flex-1 px-2.5 pb-2.5">
                      {items.length > 0 ? renderActiveCard(items[0], col) : (
                        <div data-placeholder="Aucun patient"
                          className="flex h-full items-center justify-center rounded-xl border-2 border-dashed text-[11.5px] font-medium text-gray-400"
                          style={{ borderColor: p.border }}>Aucun patient</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {listCol("completed")}
          </div>
        )}

        {/* Annulé */}
        <div data-status="canceled"
          className="mt-2.5 flex h-[52px] flex-none items-center gap-3 rounded-2xl border-[1.5px] border-dashed px-4"
          style={{
            background: PAL.canceled.tint, borderColor: PAL.canceled.border,
            animation: rejectCol === "canceled" ? "dc-shake .4s ease" : landedCol === "canceled" ? "dc-dropPop .5s cubic-bezier(.2,.9,.25,1)" : undefined,
          }}>
          <span className="h-2 w-2 flex-none rounded-full bg-red-600" />
          <span className="flex-none whitespace-nowrap text-[12.5px] font-semibold text-red-800">Annulé ({cancelled.length})</span>
          <span className="flex-none text-[11px] text-red-400">Glissez une carte ici pour annuler</span>
          <span className="ml-auto truncate text-right text-[11.5px] text-red-400">
            {cancelled.map(p => formatName(p.patient?.first_name || "", p.patient?.last_name || "")).join(" · ")}
          </span>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-[10px] px-[18px] py-[12px] text-[12.5px] font-medium text-white shadow-[0_14px_34px_rgba(20,24,26,0.28)]"
          style={{ background: toast.type === "error" ? "#b91c1c" : NAV_BLUE_DARK, animation: "dc-slideUp .34s cubic-bezier(.2,1.2,.3,1)" }}>
          {toast.msg}
        </div>
      )}

      {editingAppointment && (
        <EditAppointmentModal
          appointment={editingAppointment}
          onClose={() => setEditingAppointment(null)}
          onSuccess={() => { setEditingAppointment(null); refetch(selectedDateRef.current, true) }}
        />
      )}

      <RescheduleModal
        appointment={rescheduleApt}
        onClose={() => setRescheduleApt(null)}
        onDone={(message, success) => {
          showNotification(message, success ? "success" : "error")
          if (success) { refetch(selectedDateRef.current, true); refetchCounts() }
        }}
      />

      <AlertDialog open={!!deletingAppointmentId} onOpenChange={(open) => !open && setDeletingAppointmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Le rendez-vous sera définitivement retiré du planning.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickCaseModal apt={contextMenuApt} onClose={() => setContextMenuApt(null)} onSaved={() => showNotification("Fiche sauvegardée", "success")} />

      <CompletedAppointmentModal
        open={!!completedApt}
        onOpenChange={(open) => !open && setCompletedApt(null)}
        appointment={completedApt}
        patientName={formatName(completedApt?.patient?.first_name || "", completedApt?.patient?.last_name || "")}
        onSaved={(message) => {
          showNotification(message, message.toLowerCase().includes("erreur") ? "error" : "success")
          refetch(selectedDateRef.current, true)
        }}
        onPlanAnother={() => setControlApt(completedApt)}
      />

      <PlanControlModal
        open={!!controlApt}
        onOpenChange={(open) => !open && setControlApt(null)}
        patientId={controlApt?.ID_patient || 0}
        patientName={formatName(controlApt?.patient?.first_name || "", controlApt?.patient?.last_name || "")}
        onResult={handleControlResult}
      />

      <AlertDialog open={!!confirmingAppointment} onOpenChange={(open) => !open && setConfirmingAppointment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Description du cas vide</AlertDialogTitle>
            <AlertDialogDescription>Vous allez marquer ce rendez-vous comme terminé sans avoir rempli de description du cas. Confirmer ?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusChange} className="bg-green-600 hover:bg-green-700">Passer à Terminé</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function Home() {
  return <Dashboard />
}

export { AppContext }
