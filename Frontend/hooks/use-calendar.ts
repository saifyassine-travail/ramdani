"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient } from "../lib/api"

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMonthlyCounts = useCallback(async (date: Date) => {
    try {
      setLoading(true)
      setError(null)

      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      const response = await apiClient.getMonthlyCounts(yearMonth)

      if (response.success && response.data) {
        // Ensure response.data is a Record<string, number>
        const counts = response.data as Record<string, number>
        setAppointmentCounts(counts)
      } else {
        console.error("Calendar fetch error:", response)
        setError(response.message || "Impossible de charger les rendez-vous du mois")
        setAppointmentCounts({})
      }
    } catch (err) {
      console.error("Calendar hook error:", err)
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
      setAppointmentCounts({})
    } finally {
      setLoading(false)
    }
  }, [])

  const navigateMonth = useCallback((direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }, [])

  useEffect(() => {
    fetchMonthlyCounts(currentDate)
  }, [currentDate, fetchMonthlyCounts])

  // Refresh the dot counts as soon as an appointment is created anywhere in
  // the app (new-appointment dialog, "Planifier un autre RV", etc.) so the
  // calendar reflects it without navigating away or reloading.
  useEffect(() => {
    const handler = () => fetchMonthlyCounts(currentDate)
    window.addEventListener("appointmentCreated", handler)
    return () => window.removeEventListener("appointmentCreated", handler)
  }, [currentDate, fetchMonthlyCounts])

  return {
    currentDate,
    appointmentCounts,
    loading,
    error,
    navigateMonth,
    refetch: () => fetchMonthlyCounts(currentDate),
  }
}
