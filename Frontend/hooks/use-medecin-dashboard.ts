"use client"

import { useState, useEffect, useCallback } from "react"
import { medecinApiClient, type MedecinDashboardData } from "../lib/medecin-api"

export function useMedecinDashboard() {
  const [dashboardData, setDashboardData] = useState<MedecinDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await medecinApiClient.getDashboard()

      if (response.success && response.data) {
        setDashboardData(response.data)
      } else {
        setError(response.message || "Impossible de charger le tableau de bord")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }, [])

  const updateStatus = useCallback(
    async (appointmentId: number, status: string) => {
      try {
        const response = await medecinApiClient.updateStatus(appointmentId, status)
        if (response.success) {
          await fetchDashboard() // Refresh dashboard data
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : "Une erreur est survenue" }
      }
    },
    [fetchDashboard],
  )

  const navigatePatient = useCallback(
    async (direction: "next" | "previous") => {
      try {
        const response = await medecinApiClient.navigatePatient(direction)
        if (response.success) {
          await fetchDashboard() // Refresh dashboard data
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : "Une erreur est survenue" }
      }
    },
    [fetchDashboard],
  )

  const returnToConsultation = useCallback(
    async (appointmentId: number) => {
      try {
        const response = await medecinApiClient.returnToConsultation(appointmentId)
        if (response.success) {
          await fetchDashboard() // Refresh dashboard data
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : "Une erreur est survenue" }
      }
    },
    [fetchDashboard],
  )

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return {
    dashboardData,
    loading,
    error,
    refetch: fetchDashboard,
    updateStatus,
    navigatePatient,
    returnToConsultation,
  }
}
