"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar as CalendarIcon, Check, Loader2, CalendarClock } from "lucide-react"
import { apiClient } from "@/lib/api"

interface PlanControlModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: number
  patientName: string
  defaultDays?: number
  onResult?: (success: boolean, message: string) => void
}

export default function PlanControlModal({
  open,
  onOpenChange,
  patientId,
  patientName,
  defaultDays = 90,
  onResult,
}: PlanControlModalProps) {
  const [days, setDays] = useState<number>(defaultDays)
  const [creating, setCreating] = useState(false)
  const [checking, setChecking] = useState(false)
  const [dayCount, setDayCount] = useState<number | null>(null)

  // Reset state each time the modal opens, loading the configured default day count
  useEffect(() => {
    if (!open) return
    setDayCount(null)
    let active = true
    apiClient
      .getUserSettings()
      .then((res) => {
        if (!active) return
        const s: any = (res?.data as any)?.data ?? res?.data
        const configured = Number(s?.default_control_days)
        setDays(Number.isFinite(configured) && configured > 0 ? configured : defaultDays)
      })
      .catch(() => {
        if (active) setDays(defaultDays)
      })
    return () => {
      active = false
    }
  }, [open, defaultDays])

  // Target date = today + N days (midnight)
  const targetDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + (Number.isFinite(days) ? days : 0))
    return d
  }, [days])

  const dateLabel = targetDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const isoDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(
    targetDate.getDate(),
  ).padStart(2, "0")}`

  // Check how many appointments already exist that day (debounced)
  useEffect(() => {
    if (!open) return
    let active = true
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.getAppointments(isoDate, true)
        if (!active) return
        setDayCount(res.success && res.data ? (res.data as any).count ?? 0 : null)
      } catch {
        if (active) setDayCount(null)
      } finally {
        if (active) setChecking(false)
      }
    }, 350)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isoDate, open])

  const handleConfirm = async () => {
    if (days < 1) return
    setCreating(true)
    try {
      const res = await apiClient.createAppointment({
        patient_id: patientId,
        type: "Control",
        appointment_date: isoDate,
      })
      if (res.success) {
        onResult?.(true, (res.data as any)?.message || `Contrôle programmé pour le ${dateLabel}`)
        onOpenChange(false)
      } else {
        onResult?.(false, res.message || "Erreur lors de la création du contrôle")
      }
    } catch (err) {
      onResult?.(false, "Erreur réseau lors de la création du contrôle")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <CalendarClock className="h-5 w-5" />
            Planifier un Contrôle
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-1 text-sm text-gray-500">
          Contrôle pour <span className="font-semibold text-gray-700">{patientName || "ce patient"}</span>
        </p>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nombre de jours</label>
            <Input
              type="number"
              min={1}
              value={Number.isFinite(days) ? days : ""}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                setDays(isNaN(n) ? 0 : n)
              }}
              className="focus-visible:ring-blue-500"
            />
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex items-center gap-2 text-blue-800">
              <CalendarIcon className="h-4 w-4" />
              <span className="font-medium capitalize">{dateLabel}</span>
            </div>
            <div className="mt-1 pl-6 text-sm">
              {checking ? (
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vérification...
                </span>
              ) : dayCount === null ? (
                <span className="text-gray-400">—</span>
              ) : dayCount === 0 ? (
                <span className="flex items-center gap-1 text-green-600">
                  Aucun rendez-vous ce jour <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="text-amber-600">
                  {dayCount} rendez-vous déjà prévu{dayCount > 1 ? "s" : ""} ce jour
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={creating || days < 1}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création...
              </>
            ) : (
              "Confirmer"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
