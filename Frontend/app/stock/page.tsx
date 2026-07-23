"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useStock } from "@/hooks/use-stock"
import { useToast } from "@/hooks/use-toast"
import type { StockItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Search,
  Plus,
  Edit,
  Archive,
  RotateCcw,
  Save,
  Package,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Minus,
  AlertTriangle,
  CalendarClock,
} from "lucide-react"

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("fr-FR")
}

function isPastDate(dateStr?: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

export default function StockPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    threshold: "",
    unit: "",
    supplier: "",
    purchase_price: "",
    expiration_date: "",
  })

  const {
    stock,
    searchStock,
    createStockItem,
    updateStockItem,
    toggleArchiveStatus,
    adjustQuantity,
    fetchStock,
    currentPage,
    totalPages,
    total,
    loading,
    error,
  } = useStock(showArchived)

  const debounceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      let active = true
      setIsSearching(true)
      searchStock(debouncedSearchQuery).finally(() => {
        if (active) setIsSearching(false)
      })
      return () => {
        active = false
      }
    }
    fetchStock(1)
  }, [debouncedSearchQuery, searchStock, fetchStock])

  const filteredStock = useMemo(() => {
    let list = stock.filter((item) => (showArchived ? item.archived : !item.archived))
    if (debouncedSearchQuery.trim()) {
      list = list.filter((item) => item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
    }
    return list
  }, [stock, debouncedSearchQuery, showArchived])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const resetForm = () =>
    setFormData({ name: "", quantity: "", threshold: "", unit: "", supplier: "", purchase_price: "", expiration_date: "" })

  const handleAddItem = useCallback(() => {
    setEditingItem(null)
    resetForm()
    setIsModalOpen(true)
  }, [])

  const handleEditItem = useCallback((item: StockItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      quantity: item.quantity != null ? String(item.quantity) : "0",
      threshold: item.threshold != null ? String(item.threshold) : "",
      unit: item.unit || "",
      supplier: item.supplier || "",
      purchase_price: item.purchase_price != null ? String(item.purchase_price) : "",
      expiration_date: item.expiration_date ? item.expiration_date.slice(0, 10) : "",
    })
    setIsModalOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)

      try {
        const stockData = {
          name: formData.name,
          quantity: Number.parseInt(formData.quantity, 10) || 0,
          threshold: formData.threshold.trim() ? Number.parseInt(formData.threshold, 10) : null,
          unit: formData.unit || undefined,
          supplier: formData.supplier || undefined,
          purchase_price: formData.purchase_price.trim() ? Number.parseFloat(formData.purchase_price) : null,
          expiration_date: formData.expiration_date || null,
        }

        let result
        if (editingItem) {
          result = await updateStockItem(editingItem.ID_Stock, stockData)
        } else {
          result = await createStockItem(stockData)
        }

        if (result.success) {
          setIsModalOpen(false)
          resetForm()
        } else {
          toast({ title: "Erreur", description: result.message, variant: "destructive" })
        }
      } catch (err) {
        toast({ title: "Erreur", description: "Une erreur s'est produite", variant: "destructive" })
      } finally {
        setSubmitting(false)
      }
    },
    [editingItem, formData, createStockItem, updateStockItem, toast],
  )

  const handleArchive = useCallback((item: StockItem) => {
    setSelectedItem(item)
    setIsArchiveModalOpen(true)
  }, [])

  const handleRestore = useCallback((item: StockItem) => {
    setSelectedItem(item)
    setIsRestoreModalOpen(true)
  }, [])

  const confirmArchive = useCallback(async () => {
    if (selectedItem) {
      await toggleArchiveStatus(selectedItem.ID_Stock)
    }
    setIsArchiveModalOpen(false)
    setSelectedItem(null)
  }, [selectedItem, toggleArchiveStatus])

  const confirmRestore = useCallback(async () => {
    if (selectedItem) {
      await toggleArchiveStatus(selectedItem.ID_Stock)
    }
    setIsRestoreModalOpen(false)
    setSelectedItem(null)
  }, [selectedItem, toggleArchiveStatus])

  const handleAdjust = useCallback(
    async (item: StockItem, delta: number) => {
      const result = await adjustQuantity(item.ID_Stock, delta)
      if (!result.success) {
        toast({ title: "Erreur", description: result.message, variant: "destructive" })
      }
    },
    [adjustQuantity, toast],
  )

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">
          <span className="text-blue-700 border-b border-gray-600 italic">Gestion</span>{" "}
          <span className="text-gray-600">du Stock</span>
        </h1>

        <div className="flex flex-col w-full md:flex-row md:items-center gap-4">
          <div className="flex gap-2 mr-4">
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
              className="text-xs"
            >
              <Package className="w-3 h-3 mr-1" />
              Actifs
            </Button>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(true)}
              className="text-xs"
            >
              <Archive className="w-3 h-3 mr-1" />
              Archivés
            </Button>
          </div>

          <div className="relative mr-auto max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
            <Input
              placeholder="Rechercher un article..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-10"
              autoComplete="off"
            />
          </div>

          <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un Article
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-blue-700 font-bold">Nom</TableHead>
              <TableHead className="text-blue-700 font-bold">Quantité</TableHead>
              <TableHead className="text-blue-700 font-bold">Unité</TableHead>
              <TableHead className="text-blue-700 font-bold">Péremption</TableHead>
              <TableHead className="text-blue-700 font-bold">Fournisseur</TableHead>
              <TableHead className="text-blue-700 font-bold">Prix d'achat (DH)</TableHead>
              {showArchived && <TableHead className="text-blue-700 font-bold">Statut</TableHead>}
              <TableHead className="text-blue-700 font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showArchived ? 8 : 7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2">Chargement du stock...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showArchived ? 8 : 7} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Package className="w-12 h-12 text-blue-300 mb-2" />
                    <p className="text-gray-500">Aucun article {showArchived ? "archivé" : ""} trouvé</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredStock.map((item) => {
                const expired = isPastDate(item.expiration_date)
                const formattedExpiration = formatDate(item.expiration_date)
                return (
                  <TableRow key={item.ID_Stock} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          disabled={item.quantity <= 0 || !!item.archived}
                          onClick={() => handleAdjust(item, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span
                          className={`min-w-[2ch] text-center font-semibold ${item.is_low_stock ? "text-red-600" : "text-gray-800"}`}
                        >
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          disabled={!!item.archived}
                          onClick={() => handleAdjust(item, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        {item.is_low_stock && (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Stock bas
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{item.unit || "—"}</TableCell>
                    <TableCell>
                      {formattedExpiration ? (
                        expired ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Expiré ({formattedExpiration})
                          </Badge>
                        ) : item.is_expiring_soon ? (
                          <Badge className="text-[10px] bg-orange-100 text-orange-700 hover:bg-orange-100">
                            <CalendarClock className="w-3 h-3 mr-1" />
                            Expire bientôt ({formattedExpiration})
                          </Badge>
                        ) : (
                          <span className="text-gray-600 text-sm">{formattedExpiration}</span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">{item.supplier || "—"}</TableCell>
                    <TableCell>{item.purchase_price != null ? Number(item.purchase_price).toFixed(2) : "—"}</TableCell>
                    {showArchived && (
                      <TableCell>
                        <Badge variant={item.archived ? "secondary" : "default"}>
                          {item.archived ? (
                            <>
                              <Archive className="w-3 h-3 mr-1" />
                              Archivé
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Actif
                            </>
                          )}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex space-x-1">
                        {!item.archived ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditItem(item)}
                              className="text-green-600 hover:text-green-900 hover:bg-green-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(item)}
                              className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRestore(item)}
                            className="text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!debouncedSearchQuery.trim() && !loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages} • {total} articles
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => fetchStock(currentPage - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => fetchStock(currentPage + 1)}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier un Article" : "Ajouter un Article"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nom*</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Vaccin, Stérilet, Compresses..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantité*</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <Label htmlFor="threshold">Seuil d'alerte</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.threshold}
                  onChange={(e) => setFormData((prev) => ({ ...prev, threshold: e.target.value }))}
                  placeholder="Ex: 10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="unit">Unité</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="Ex: Boîte, Flacon, Unité, Carton"
              />
            </div>
            <div>
              <Label htmlFor="supplier">Fournisseur</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                placeholder="Nom du fournisseur"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchase_price">Prix d'achat (DH)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, purchase_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="expiration_date">Date de péremption</Label>
                <Input
                  id="expiration_date"
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expiration_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={submitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 text-yellow-500 bg-yellow-50 p-4 rounded-full">
              <Archive className="w-8 h-8" />
            </div>
            <DialogTitle>Confirmer l'archivage</DialogTitle>
            <p className="mt-2 text-gray-600">
              Êtes-vous sûr de vouloir archiver{" "}
              <span className="font-bold text-gray-800">{selectedItem?.name}</span> ?
            </p>
          </div>
          <div className="flex justify-center space-x-4 pt-4">
            <Button variant="outline" onClick={() => setIsArchiveModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmArchive} className="bg-gray-500 hover:bg-yellow-600">
              <Archive className="w-4 h-4 mr-2" />
              Archiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 text-green-500 bg-green-50 p-4 rounded-full">
              <RotateCcw className="w-8 h-8" />
            </div>
            <DialogTitle>Confirmer la restauration</DialogTitle>
            <p className="mt-2 text-gray-600">
              Êtes-vous sûr de vouloir restaurer{" "}
              <span className="font-bold text-gray-800">{selectedItem?.name}</span> ?
            </p>
          </div>
          <div className="flex justify-center space-x-4 pt-4">
            <Button variant="outline" onClick={() => setIsRestoreModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmRestore} className="bg-green-500 hover:bg-green-600">
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
