"use client"

import { useState, useCallback } from "react"
import { apiClient } from "../lib/api"
import type { Medicament } from "../lib/api"

const PER_PAGE = 50

export function useMedicaments(showArchived = false) {
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = PER_PAGE

  const fetchMedicaments = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.getMedicaments(showArchived, page, PER_PAGE)

        if (response && response.success && Array.isArray(response.data)) {
          const transformedMedicaments = response.data.map((medicament) => ({
            ...medicament,
            id: medicament.ID_Medicament || medicament.id,
            price: Number(medicament.price || 0),
            archived: Boolean(medicament.archived),
          }))

          setMedicaments(transformedMedicaments)

          const meta = response.meta
          if (meta) {
            setTotal(meta.total)
            setCurrentPage(meta.current_page)
            setTotalPages(meta.last_page)
          } else {
            setTotal(transformedMedicaments.length)
            setCurrentPage(1)
            setTotalPages(1)
          }
        } else {
          setError("Failed to fetch medicaments - unexpected response format")
          setMedicaments([])
        }
      } catch (err) {
        setError("Network error occurred")
        setMedicaments([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived],
  )

  const searchMedicaments = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        fetchMedicaments(1)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.searchMedicaments(term, showArchived)

        if (response && response.success) {
          let searchResults = []

          if (response.data) {
            if (Array.isArray(response.data)) {
              searchResults = response.data
            } else if (response.data.data && Array.isArray(response.data.data)) {
              searchResults = response.data.data
            } else if (typeof response.data === "object" && response.data !== null) {
              searchResults = [response.data]
            } else {
              setError("Search returned unexpected data format")
              setMedicaments([])
              return
            }
          } else {
            searchResults = []
          }

          const transformedMedicaments = searchResults.map((medicament) => ({
            ...medicament,
            id: medicament.ID_Medicament || medicament.id,
            price: Number(medicament.price || 0),
            archived: Boolean(medicament.archived),
          }))

          setMedicaments(transformedMedicaments)
          setTotal(transformedMedicaments.length)
          setCurrentPage(1)
          setTotalPages(1)
        } else {
          setError("Search request failed")
          setMedicaments([])
        }
      } catch (err) {
        setError(`Search error: ${err.message || "Network error occurred"}`)
        setMedicaments([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived, fetchMedicaments],
  )

  const createMedicament = async (medicamentData: any) => {
    try {
      const response = await apiClient.createMedicament(medicamentData)

      if (response.success) {
        fetchMedicaments() // Refresh the list
        return { success: true }
      } else {
        return { success: false, message: response.message || "Failed to create medicament" }
      }
    } catch (err) {
      return { success: false, message: "Network error occurred" }
    }
  }

  const updateMedicament = async (id: number, medicamentData: any) => {
    try {
      const response = await apiClient.updateMedicament(id, medicamentData)

      if (response.success) {
        fetchMedicaments(currentPage) // Refresh the current page
        return { success: true }
      } else {
        return { success: false, message: response.message || "Failed to update medicament" }
      }
    } catch (err) {
      return { success: false, message: "Network error occurred" }
    }
  }

  const toggleFavorite = async (medicamentId: number) => {
    // Optimistic update — flip immediately
    setMedicaments((prev) =>
      prev.map((m) =>
        Number(m.ID_Medicament) === Number(medicamentId) ? { ...m, is_favorite: !m.is_favorite } : m
      )
    )
    try {
      const response = await apiClient.toggleFavoriteMedicament(medicamentId)
      if (response.success) {
        return { success: true }
      }
      // Revert on failure
      setMedicaments((prev) =>
        prev.map((m) =>
          Number(m.ID_Medicament) === Number(medicamentId) ? { ...m, is_favorite: !m.is_favorite } : m
        )
      )
      return { success: false, message: response.message || "Failed to update favorite" }
    } catch {
      // Revert on error
      setMedicaments((prev) =>
        prev.map((m) =>
          Number(m.ID_Medicament) === Number(medicamentId) ? { ...m, is_favorite: !m.is_favorite } : m
        )
      )
      return { success: false, message: "Network error occurred" }
    }
  }

  const toggleArchiveStatus = async (medicamentId: number) => {
    try {
      const medicament = medicaments.find((m) => m.ID_Medicament === medicamentId || m.id === medicamentId)
      if (!medicament) return { success: false, message: "Medicament not found" }

      let response
      if (medicament.archived) {
        response = await apiClient.restoreMedicament(medicamentId)
      } else {
        response = await apiClient.archiveMedicament(medicamentId)
      }

      if (response.success) {
        await fetchMedicaments(currentPage)
        return { success: true, message: response.data?.message }
      } else {
        return { success: false, message: response.message || "Failed to update medicament status" }
      }
    } catch (err) {
      return { success: false, message: "Network error occurred" }
    }
  }

  return {
    medicaments,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    perPage,
    fetchMedicaments,
    searchMedicaments,
    createMedicament,
    updateMedicament,
    toggleArchiveStatus,
    toggleFavorite,
  }
}
