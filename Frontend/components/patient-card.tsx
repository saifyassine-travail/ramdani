"use client"

import type React from "react"
import { useState } from "react"

import { useRouter } from "next/navigation"

interface PatientCardProps {
  name: string
  type: string
  status: string
  appointmentId: string | number
  patientId: number
  time?: string | null
  startedAt?: string | null
  nowTick?: number
  mutuelle?: boolean
  onStatusChange?: (id: string | number, newStatus: string) => void
  onMutuelleToggle?: (id: string | number) => void
  onDelete?: (id: string | number) => void
  onEdit?: (id: number) => void
}

const ACCENTS: Record<string, string> = {
  scheduled: "#4b5563",
  waiting: "#ca8a04",
  preparing: "#ea580c",
  consulting: "#2563eb",
  completed: "#16a34a",
  canceled: "#dc2626",
}

function formatTime(raw?: string | null): string {
  if (!raw) return "--:--"
  // "08:30" / "08:30:00" / "2026-08-30T08:30:00"
  const m = raw.match(/(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }
  return "--:--"
}

function elapsedLabel(startedAt?: string | null): string | null {
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  if (isNaN(start)) return null
  const mins = Math.max(0, Math.round((Date.now() - start) / 60000))
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `depuis ${mins} min`
  const h = Math.floor(mins / 60)
  return `depuis ${h} h ${mins % 60} min`
}

export default function PatientCard({
  name,
  type,
  status,
  appointmentId,
  patientId,
  time,
  startedAt,
  nowTick,
  mutuelle = false,
  onMutuelleToggle,
  onDelete,
  onEdit,
}: PatientCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const accent = ACCENTS[status] || "#0f766e"
  const isLive = status === "consulting"
  // nowTick is only referenced so the parent's minute-ticker re-renders the elapsed label
  void nowTick
  const elapsed = isLive ? elapsedLabel(startedAt) : null

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(appointmentId)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    const id = typeof appointmentId === "string" ? Number.parseInt(appointmentId) : appointmentId
    onEdit?.(id)
  }

  return (
    <div
      className={`patient-card group relative rounded-xl border bg-white p-3 transition-all duration-200 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(20,24,26,0.13)] ${
        isDeleting ? "opacity-50" : ""
      }`}
      style={{
        borderColor: isLive ? "#bcd7f2" : "#e4e9ec",
        boxShadow: "0 1px 2px rgba(20,24,26,.05)",
        animation: isLive ? "dc-liveRing 2.4s ease-out infinite" : undefined,
      }}
      data-appointment-id={appointmentId}
      data-status={status}
      draggable={!isDeleting}
    >
      <span
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ background: accent, animation: isLive ? "dc-dotPulse 1.6s ease-in-out infinite" : undefined }}
      />
      <div className="pl-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] font-semibold" style={{ color: accent }}>
            {formatTime(time)}
          </span>
          {elapsed ? (
            <span className="flex items-center gap-1 rounded-full bg-[#eaf2fb] px-2 py-[3px] text-[10.5px] font-medium text-[#2f7fd4] whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f7fd4]" style={{ animation: "dc-dotPulse 1.2s ease-in-out infinite" }} />
              {elapsed}
            </span>
          ) : (
            <span className="rounded-full border border-[#e8ecee] px-2 py-[3px] text-[10.5px] text-[#8b9399] whitespace-nowrap">
              {type}
            </span>
          )}
          {mutuelle && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onMutuelleToggle?.(appointmentId)
              }}
              className="rounded-full bg-[#e6efee] px-2 py-[3px] text-[10.5px] font-medium text-[#0f766e] whitespace-nowrap cursor-pointer"
              title="Mutuelle"
            >
              Mutuelle
            </span>
          )}
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleEdit}
              title="Modifier le rendez-vous"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7479] hover:bg-[#eef3f4] hover:text-[#0f766e]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/patients/${patientId}`)
              }}
              title="Voir les détails du patient"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7479] hover:bg-[#eef3f4] hover:text-[#0f766e]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              title="Supprimer le rendez-vous"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7479] hover:bg-[#fbeceb] hover:text-[#c2554b] disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="mt-2 text-[14px] font-medium leading-tight text-[#14181a]" style={{ textWrap: "pretty" } as React.CSSProperties}>
          {name}
        </div>
      </div>
    </div>
  )
}
