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

      console.log("[v0] Calendar API response:", response)
      console.log("[v0] Calendar response data:", response.data)

      if (response.success && response.data) {
        // Ensure response.data is a Record<string, number>
        const counts = response.data as Record<string, number>
        console.log("[v0] Setting appointment counts:", counts)
        setAppointmentCounts(counts)
      } else {
        const errorMsg = response.message || "Failed to fetch monthly counts"
        console.error("[v0] Calendar fetch error:", errorMsg)
        console.error("[v0] Calendar fetch error details:", response)
        // expose full response for debugging in browser console
        setError(errorMsg)
        setAppointmentCounts({})
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred"
      console.error("[v0] Calendar hook error:", errorMsg)
      console.error("[v0] Calendar hook caught:", err)
      // store full error string for UI
      setError(errorMsg)
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

  return {
    currentDate,
    appointmentCounts,
    loading,
    error,
    navigateMonth,
    refetch: () => fetchMonthlyCounts(currentDate),
  }
}
