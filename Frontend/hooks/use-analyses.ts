"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient } from "../lib/api"
import type { Analysis } from "../lib/api"

export function useAnalyses(showArchived = false) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const fetchAnalyses = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.getAnalyses(showArchived, page)

        if (response && response.success && response.data) {
          const analysesArray = response.data
          const meta = response.meta || { current_page: 1, last_page: 1, total: Array.isArray(analysesArray) ? analysesArray.length : 0, per_page: 15 }

          if (Array.isArray(analysesArray)) {
            const transformedAnalyses = analysesArray.map((analysis: any) => ({
              ...analysis,
              id: analysis.ID_Analyse || analysis.id,
              archived: Boolean(analysis.archived),
            }))

            setAnalyses(transformedAnalyses)
            setTotal(meta.total)
            setCurrentPage(meta.current_page)
            setTotalPages(meta.last_page)
            setPerPage(meta.per_page)
          } else {
            setError("Format de réponse invalide")
            setAnalyses([])
          }
        } else {
          setError("Impossible de charger les analyses")
          setAnalyses([])
        }
      } catch (err) {
        setError("Erreur réseau")
        console.error(err)
        setAnalyses([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived],
  )

  const searchAnalyses = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        fetchAnalyses(1)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.searchAnalyses(term, showArchived)

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
              setError("Format de réponse de recherche invalide")
              setAnalyses([])
              return
            }
          } else {
            searchResults = []
          }

          const transformedAnalyses = searchResults.map((analysis) => ({
            ...analysis,
            id: analysis.ID_Analyse || analysis.id,
            archived: Boolean(analysis.archived),
          }))

          setAnalyses(transformedAnalyses)
          setTotal(transformedAnalyses.length)
          setCurrentPage(1)
          setTotalPages(1)
        } else {
          setError("La recherche a échoué")
          setAnalyses([])
        }
      } catch (err) {
        setError("Erreur réseau lors de la recherche")
        setAnalyses([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived, fetchAnalyses],
  )

  const createAnalysis = async (analysisData: any) => {
    try {
      const response = await apiClient.createAnalysis(analysisData)

      if (response.success) {
        fetchAnalyses() // Refresh the list
        return { success: true }
      } else {
        return { success: false, message: response.message || "Impossible de créer l'analyse" }
      }
    } catch (err) {
      return { success: false, message: "Erreur réseau" }
    }
  }

  const updateAnalysis = async (id: number, analysisData: any) => {
    try {
      const response = await apiClient.updateAnalysis(id, analysisData)

      if (response.success) {
        fetchAnalyses() // Refresh the list
        return { success: true }
      } else {
        return { success: false, message: response.message || "Impossible de mettre à jour l'analyse" }
      }
    } catch (err) {
      return { success: false, message: "Erreur réseau" }
    }
  }

  const toggleFavorite = async (analysisId: number) => {
    // Optimistic update — flip immediately so the UI responds instantly
    setAnalyses((prev) =>
      prev.map((a) =>
        Number(a.ID_Analyse) === Number(analysisId) ? { ...a, is_favorite: !a.is_favorite } : a
      )
    )
    try {
      const response = await apiClient.toggleFavoriteAnalysis(analysisId)
      if (response.success) {
        return { success: true }
      }
      // Revert on failure
      setAnalyses((prev) =>
        prev.map((a) =>
          Number(a.ID_Analyse) === Number(analysisId) ? { ...a, is_favorite: !a.is_favorite } : a
        )
      )
      return { success: false, message: response.message || "Impossible de mettre à jour le favori" }
    } catch {
      // Revert on error
      setAnalyses((prev) =>
        prev.map((a) =>
          Number(a.ID_Analyse) === Number(analysisId) ? { ...a, is_favorite: !a.is_favorite } : a
        )
      )
      return { success: false, message: "Erreur réseau" }
    }
  }

  const toggleArchiveStatus = async (analysisId: number) => {
    try {
      const analysis = analyses.find((a) => a.ID_Analyse === analysisId || a.id === analysisId)
      if (!analysis) return { success: false, message: "Analyse introuvable" }

      let response
      if (analysis.archived) {
        response = await apiClient.restoreAnalysis(analysisId)
      } else {
        response = await apiClient.archiveAnalysis(analysisId)
      }

      if (response.success) {
        await fetchAnalyses(1)
        return { success: true, message: response.data?.message }
      } else {
        return { success: false, message: response.message || "Impossible de modifier le statut de l'analyse" }
      }
    } catch (err) {
      return { success: false, message: "Erreur réseau" }
    }
  }

  useEffect(() => {
    fetchAnalyses(1)
  }, [showArchived, fetchAnalyses])

  return {
    analyses,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    perPage,
    fetchAnalyses,
    searchAnalyses,
    createAnalysis,
    updateAnalysis,
    toggleArchiveStatus,
    toggleFavorite,
  }
}
