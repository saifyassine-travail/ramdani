"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient, type Appointment } from "../lib/api"

export interface GroupedAppointments {
  scheduled: Appointment[]
  waiting: Appointment[]
  preparing: Appointment[]
  consulting: Appointment[]
  completed: Appointment[]
  canceled: Appointment[]
}

export function useAppointments(selectedDate?: string) {
  const [appointments, setAppointments] = useState<GroupedAppointments>({
    scheduled: [],
    waiting: [],
    preparing: [],
    consulting: [],
    completed: [],
    canceled: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, GroupedAppointments>>(new Map())
  // Latest appointments snapshot, so callbacks can read current state without re-creating
  const appointmentsRef = useRef<GroupedAppointments>(appointments)
  useEffect(() => {
    appointmentsRef.current = appointments
  }, [appointments])

  const mapStatusToKey = (status: string): keyof GroupedAppointments => {
    const statusMap: Record<string, keyof GroupedAppointments> = {
      Programmé: "scheduled",
      "Salle dattente": "waiting",
      "En préparation": "preparing",
      "En consultation": "consulting",
      Terminé: "completed",
      Annulé: "canceled",
    }
    return statusMap[status] || "scheduled"
  }

  const mapKeyToStatus = (key: string): string => {
    const keyMap: Record<string, string> = {
      scheduled: "scheduled",
      waiting: "waiting",
      preparing: "preparing",
      consulting: "consulting",
      completed: "completed",
      canceled: "canceled",
    }
    return keyMap[key] || "scheduled"
  }

  const fetchAppointments = useCallback(async (date?: string, forceRefresh = false) => {
    try {
      const cacheKey = date || "default"
      if (!forceRefresh && cacheRef.current.has(cacheKey)) {
        setAppointments(cacheRef.current.get(cacheKey)!)
        setLoading(false)
        return
      }

      if (!forceRefresh) setLoading(true)
      setError(null)

      const response = await apiClient.getAppointments(date, forceRefresh)

      if (response.success && response.data) {
        const grouped: GroupedAppointments = {
          scheduled: [],
          waiting: [],
          preparing: [],
          consulting: [],
          completed: [],
          canceled: [],
        }

        if (response.data.grouped) {
          Object.entries(response.data.grouped).forEach(([status, appointmentList]) => {
            const statusKey = mapStatusToKey(status)
            grouped[statusKey] = appointmentList.map((appointment) => ({
              ...appointment,
              mutuelle: Boolean(appointment.mutuelle),
            }))
          })
        }

        cacheRef.current.set(cacheKey, grouped)
        setAppointments(grouped)
        setLoading(false)
      } else {
        const errorMsg = response.message || "Failed to fetch appointments"
        setError(`${errorMsg}${response.error ? ` (${response.error})` : ""}`)
        setLoading(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(`Connection failed: ${errorMessage}. Please check if the Laravel backend is running.`)
      setLoading(false)
    }
  }, [])

  const updateAppointmentStatus = useCallback(
    async (appointmentId: number, newStatus: string) => {
      try {
        setAppointments((prev) => {
          const newAppointments = { ...prev }
          let movedAppointment: Appointment | null = null

          Object.keys(newAppointments).forEach((status) => {
            const statusKey = status as keyof GroupedAppointments
            const index = newAppointments[statusKey].findIndex((app) => app.ID_RV === appointmentId)
            if (index !== -1) {
              movedAppointment = {
                ...newAppointments[statusKey][index],
                status: newStatus,
              }
              newAppointments[statusKey].splice(index, 1)
            }
          })

          if (movedAppointment) {
            const validStatuses: (keyof GroupedAppointments)[] = [
              "scheduled",
              "waiting",
              "preparing",
              "consulting",
              "completed",
              "canceled",
            ]
            const newStatusKey = validStatuses.includes(newStatus as keyof GroupedAppointments)
              ? (newStatus as keyof GroupedAppointments)
              : "scheduled"

            newAppointments[newStatusKey].push(movedAppointment)
          }

          cacheRef.current.clear()
          return newAppointments
        })

        const response = await apiClient.updateAppointmentStatus(appointmentId, newStatus)

        if (!response.success) {
          // Revert on error by refetching
          throw new Error(response.message || "Failed to update status")
        }

        return { success: true, message: "Statut mis à jour avec succès" }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        console.log("[v0] Status update error:", errorMessage)

        // Revert the UI change by refetching the appointments
        await fetchAppointments(selectedDate)

        if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("Connection")) {
          setError(errorMessage)
        }
        return { success: false, message: errorMessage }
      }
    },
    [fetchAppointments, selectedDate],
  )

  const setMutuelleValue = useCallback((appointmentId: number, value: boolean) => {
    setAppointments((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((status) => {
        const statusKey = status as keyof GroupedAppointments
        const i = next[statusKey].findIndex((app) => app.ID_RV === appointmentId)
        if (i !== -1) {
          next[statusKey] = [...next[statusKey]]
          next[statusKey][i] = { ...next[statusKey][i], mutuelle: value }
        }
      })
      cacheRef.current.clear()
      return next
    })
  }, [])

  const toggleMutuelle = useCallback(
    async (appointmentId: number) => {
      // Optimistic flip so the toggle feels instant
      let previous = false
      Object.values(appointmentsRef.current).some((list: Appointment[]) => {
        const found = list.find((app: Appointment) => app.ID_RV === appointmentId)
        if (found) {
          previous = Boolean(found.mutuelle)
          return true
        }
        return false
      })
      setMutuelleValue(appointmentId, !previous)

      try {
        const response = await apiClient.toggleMutuelle(appointmentId)
        if (!response.success) throw new Error(response.message || "Failed to toggle mutuelle")
        // Align with the server's authoritative value
        setMutuelleValue(appointmentId, Boolean(response.data?.mutuelle))
        return { success: true }
      } catch (err) {
        setMutuelleValue(appointmentId, previous) // revert
        const errorMessage = err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        return { success: false, message: errorMessage }
      }
    },
    [setMutuelleValue],
  )

  const deleteAppointment = useCallback(async (appointmentId: number) => {
    try {
      const response = await apiClient.deleteAppointment(appointmentId)

      if (response.success) {
        setAppointments((prev) => {
          const newAppointments = { ...prev }

          Object.keys(newAppointments).forEach((status) => {
            const statusKey = status as keyof GroupedAppointments
            newAppointments[statusKey] = newAppointments[statusKey].filter((app) => app.ID_RV !== appointmentId)
          })

          cacheRef.current.clear()
          return newAppointments
        })

        return { success: true, message: "Rendez-vous supprimé avec succès" }
      } else {
        return { success: false, message: response.message || "Failed to delete appointment" }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      console.error("[v0] Delete error:", errorMessage)
      return { success: false, message: errorMessage }
    }
  }, [])

  useEffect(() => {
    fetchAppointments(selectedDate)

    let intervalId: ReturnType<typeof setInterval> | null = null
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
    const start = () => {
      if (intervalId) return
      intervalId = setInterval(() => {
        if (typeof document === "undefined" || document.visibilityState === "visible") {
          fetchAppointments(selectedDate, true)
        }
      }, 5000) // Poll every 5s while the tab is visible
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAppointments(selectedDate, true) // catch up immediately on focus
        start()
      } else {
        stop() // don't poll in the background
      }
    }

    start()
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility)
    }
    return () => {
      stop()
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility)
      }
    }
  }, [fetchAppointments, selectedDate])

  return {
    appointments,
    loading,
    error,
    refetch: fetchAppointments,
    updateAppointmentStatus,
    toggleMutuelle,
    deleteAppointment,
  }
}
