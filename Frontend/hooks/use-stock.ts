"use client"

import { useState, useCallback } from "react"
import { apiClient } from "../lib/api"
import type { StockItem } from "../lib/api"

const PER_PAGE = 50

export function useStock(showArchived = false) {
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = PER_PAGE

  const fetchStock = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.getStock(showArchived, page, PER_PAGE)

        if (response && response.success && Array.isArray(response.data)) {
          const transformed = response.data.map((item) => ({
            ...item,
            id: item.ID_Stock || item.id,
            quantity: Number(item.quantity || 0),
            archived: Boolean(item.archived),
          }))

          setStock(transformed)

          const meta = response.meta
          if (meta) {
            setTotal(meta.total)
            setCurrentPage(meta.current_page)
            setTotalPages(meta.last_page)
          } else {
            setTotal(transformed.length)
            setCurrentPage(1)
            setTotalPages(1)
          }
        } else {
          setError("Impossible de charger le stock")
          setStock([])
        }
      } catch (err) {
        setError("Erreur réseau")
        setStock([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived],
  )

  const searchStock = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        fetchStock(1)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.searchStock(term, showArchived)

        if (response && response.success) {
          let searchResults: any[] = []

          if (response.data) {
            if (Array.isArray(response.data)) {
              searchResults = response.data
            } else if ((response.data as any).data && Array.isArray((response.data as any).data)) {
              searchResults = (response.data as any).data
            } else if (typeof response.data === "object" && response.data !== null) {
              searchResults = [response.data]
            } else {
              setError("Format de réponse de recherche invalide")
              setStock([])
              return
            }
          } else {
            searchResults = []
          }

          const transformed = searchResults.map((item) => ({
            ...item,
            id: item.ID_Stock || item.id,
            quantity: Number(item.quantity || 0),
            archived: Boolean(item.archived),
          }))

          setStock(transformed)
          setTotal(transformed.length)
          setCurrentPage(1)
          setTotalPages(1)
        } else {
          setError("La recherche a échoué")
          setStock([])
        }
      } catch (err: any) {
        setError("Erreur réseau lors de la recherche")
        setStock([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived, fetchStock],
  )

  const createStockItem = async (stockData: any) => {
    try {
      const response = await apiClient.createStockItem(stockData)

      if (response.success) {
        fetchStock() // Refresh the list
        return { success: true }
      } else {
        return { success: false, message: response.message || "Impossible de créer l'article" }
      }
    } catch (err) {
      return { success: false, message: "Erreur réseau" }
    }
  }

  const updateStockItem = async (id: number, stockData: any) => {
    try {
      const response = await apiClient.updateStockItem(id, stockData)

      if (response.success) {
        fetchStock(currentPage) // Refresh the current page
        return { success: true }
      } else {
        return { success: false, message: response.message || "Impossible de mettre à jour l'article" }
      }
    } catch (err) {
      return { success: false, message: "Erreur réseau" }
    }
  }

  const toggleArchiveStatus = async (stockId: number) => {
    try {
      const item = stock.find((s) => s.ID_Stock === stockId || s.id === stockId)
      if (!item) return { success: false, message: "Article introuvable" }

      let response
      if (item.archived) {
        response = await apiClient.restoreStockItem(stockId)
      } else {
        response = await apiClient.archiveStockItem(stockId)
      }

      if (response.success) {
        await fetchStock(currentPage)
        return { success: true, message: (response.data as any)?.message }
      } else {
        return { success: false, message: response.message || "Impossible de modifier le statut de l'article" }
      }
    } catch (err) {
      return { success: false, message: "Erreur réseau" }
    }
  }

  const adjustQuantity = async (stockId: number, delta: number) => {
    // Optimistic update — reflect the change immediately, clamped at 0.
    const previous = stock.find((s) => s.ID_Stock === stockId || s.id === stockId)?.quantity ?? 0
    const next = Math.max(0, previous + delta)
    setStock((prev) =>
      prev.map((s) => (Number(s.ID_Stock) === Number(stockId) ? { ...s, quantity: next } : s)),
    )
    try {
      const response = await apiClient.adjustStockQuantity(stockId, delta)
      if (response.success) {
        return { success: true }
      }
      // Revert on failure
      setStock((prev) =>
        prev.map((s) => (Number(s.ID_Stock) === Number(stockId) ? { ...s, quantity: previous } : s)),
      )
      return { success: false, message: response.message || "Impossible d'ajuster la quantité" }
    } catch {
      setStock((prev) =>
        prev.map((s) => (Number(s.ID_Stock) === Number(stockId) ? { ...s, quantity: previous } : s)),
      )
      return { success: false, message: "Erreur réseau" }
    }
  }

  return {
    stock,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    perPage,
    fetchStock,
    searchStock,
    createStockItem,
    updateStockItem,
    toggleArchiveStatus,
    adjustQuantity,
  }
}
