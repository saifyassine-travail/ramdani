"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useAnalyses } from "@/hooks/use-analyses"
import { useToast } from "@/hooks/use-toast"
import type { Analysis } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Edit, Archive, RotateCcw, X, Save, Flag as Flask, CheckCircle, Loader2, Star } from "lucide-react"

export default function AnalysesPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [editingAnalysis, setEditingAnalysis] = useState<Analysis | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [formData, setFormData] = useState({
    type_analyse: "",
    departement: "",
  })

  const { analyses, searchAnalyses, createAnalysis, updateAnalysis, toggleArchiveStatus, toggleFavorite, loading, error, total, totalPages, currentPage, fetchAnalyses } =
    useAnalyses(showArchived)

  const debounceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms debounce delay

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery])

  const handleDebouncedSearch = useCallback(
    async (term: string) => {
      if (term.trim()) {
        setIsSearching(true)
        try {
          await searchAnalyses(term)
        } finally {
          setIsSearching(false)
        }
      } else {
        fetchAnalyses(1)
      }
    },
    [searchAnalyses, fetchAnalyses],
  )

  useEffect(() => {
    handleDebouncedSearch(debouncedSearchQuery)
  }, [debouncedSearchQuery, handleDebouncedSearch])

  const filteredAnalyses = useMemo(() => {
    let list = analyses.filter((a) => (showArchived ? a.archived : !a.archived))
    if (debouncedSearchQuery.trim()) {
      list = list.filter((a) => a.type_analyse.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
    }
    return [...list].sort((a, b) => {
      const aFav = a.is_favorite ? 1 : 0
      const bFav = b.is_favorite ? 1 : 0
      return bFav - aFav
    })
  }, [analyses, debouncedSearchQuery, showArchived])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleAddAnalysis = useCallback(() => {
    setEditingAnalysis(null)
    setFormData({ type_analyse: "", departement: "" })
    setIsModalOpen(true)
  }, [])

  const handleEditAnalysis = useCallback((analysis: Analysis) => {
    setEditingAnalysis(analysis)
    setFormData({
      type_analyse: analysis.type_analyse,
      departement: analysis.departement || "",
    })
    setIsModalOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)

      try {
        const analysisData = {
          type_analyse: formData.type_analyse,
          departement: formData.departement,
        }

        let result
        if (editingAnalysis) {
          result = await updateAnalysis(editingAnalysis.ID_Analyse, analysisData)
        } else {
          result = await createAnalysis(analysisData)
        }

        if (result.success) {
          setIsModalOpen(false)
          setFormData({ type_analyse: "", departement: "" })
        } else {
          console.error("Failed to save analysis:", result.message)
        }
      } catch (err) {
        console.error("Error saving analysis:", err)
      } finally {
        setSubmitting(false)
      }
    },
    [editingAnalysis, formData],
  )

  const handleArchive = useCallback((analysis: Analysis) => {
    setSelectedAnalysis(analysis)
    setIsArchiveModalOpen(true)
  }, [])

  const handleRestore = useCallback((analysis: Analysis) => {
    setSelectedAnalysis(analysis)
    setIsRestoreModalOpen(true)
  }, [])

  const confirmArchive = useCallback(async () => {
    if (selectedAnalysis) {
      await toggleArchiveStatus(selectedAnalysis.ID_Analyse)
    }
    setIsArchiveModalOpen(false)
    setSelectedAnalysis(null)
  }, [selectedAnalysis])

  const confirmRestore = useCallback(async () => {
    if (selectedAnalysis) {
      await toggleArchiveStatus(selectedAnalysis.ID_Analyse)
    }
    setIsRestoreModalOpen(false)
    setSelectedAnalysis(null)
  }, [selectedAnalysis])

  const handleRowClick = useCallback((analysis: Analysis) => {
    setSelectedAnalysis(analysis)
    setIsDetailsModalOpen(true)
  }, [])

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">
          <span className="text-blue-700 border-b border-gray-600 italic">Liste</span>{" "}
          <span className="text-gray-600">des Analyses</span>
        </h1>

        <div className="flex flex-col w-full md:flex-row md:items-center gap-4">
          {/* Archive/Active tabs */}
          <div className="flex gap-2 mr-4">
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
              className="text-xs"
            >
              <Flask className="w-3 h-3 mr-1" />
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

          {/* Search */}
          <div className="relative mr-auto max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
            <Input
              placeholder="Rechercher une analyse..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-10"
              autoComplete="off"
            />
          </div>

          {/* Add button */}
          <Button onClick={handleAddAnalysis} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Analyse
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
              <TableHead className="text-blue-700 font-bold w-8"></TableHead>
              <TableHead className="text-blue-700 font-bold">ID</TableHead>
              <TableHead className="text-blue-700 font-bold">Type d'Analyse</TableHead>
              <TableHead className="text-blue-700 font-bold">Département</TableHead>
              {showArchived && <TableHead className="text-blue-700 font-bold">Statut</TableHead>}
              <TableHead className="text-blue-700 font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow key="loading">
                <TableCell colSpan={showArchived ? 6 : 5} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2">Chargement des analyses...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAnalyses.length === 0 ? (
              <TableRow key="empty">
                <TableCell colSpan={showArchived ? 6 : 5} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Flask className="w-12 h-12 text-blue-300 mb-2" />
                    <p className="text-gray-500">Aucune analyse {showArchived ? "archivée" : ""} trouvée</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAnalyses.map((analysis) => (
                <TableRow
                  key={analysis.ID_Analyse}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(analysis)}
                >
                  <TableCell className="pr-0">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const result = await toggleFavorite(analysis.ID_Analyse)
                        if (result && !result.success) {
                          toast({ title: "Erreur", description: result.message, variant: "destructive" })
                        }
                      }}
                      className="p-1 rounded hover:bg-yellow-50 transition-colors"
                      title={analysis.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      <Star className={`w-4 h-4 ${analysis.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`} />
                    </button>
                  </TableCell>
                  <TableCell>{analysis.ID_Analyse}</TableCell>
                  <TableCell className="font-medium">{analysis.type_analyse}</TableCell>
                  <TableCell>{analysis.departement}</TableCell>
                  {showArchived && (
                    <TableCell>
                      <Badge variant={analysis.archived ? "secondary" : "default"}>
                        {analysis.archived ? (
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
                      {!analysis.archived ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditAnalysis(analysis)
                            }}
                            className="text-green-600 hover:text-green-900 hover:bg-green-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchive(analysis)
                            }}
                            className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore(analysis)
                          }}
                          className="text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {!loading && !error && filteredAnalyses.length > 0 && !isSearching && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Affichage de <span className="font-medium">{analyses.length}</span> sur <span className="font-medium">{total}</span> résultats
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalyses(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              Précédent
            </Button>
            <div className="flex items-center px-4 text-sm text-gray-600 bg-white border rounded-md">
              Page {currentPage} sur {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalyses(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              Suivant
            </Button>
          </div>
        </div>
      )
      }

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAnalysis ? "Modifier l'Analyse" : "Ajouter une Analyse"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="type_analyse">Type d'Analyse*</Label>
              <Input
                id="type_analyse"
                value={formData.type_analyse}
                onChange={(e) => setFormData((prev) => ({ ...prev, type_analyse: e.target.value }))}
                placeholder="Ex: Hématologie, Biochimie"
                required
              />
            </div>
            <div>
              <Label htmlFor="departement">Département*</Label>
              <Select
                value={formData.departement}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, departement: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laboratoire">Laboratoire</SelectItem>
                  <SelectItem value="Radiologie">Radiologie</SelectItem>
                  <SelectItem value="Microbiologie">Microbiologie</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600">{selectedAnalysis?.type_analyse}</DialogTitle>
            <p className="text-sm text-gray-500">
              ID: <span className="font-medium text-gray-700">{selectedAnalysis?.ID_Analyse}</span>
            </p>
            <p className="text-gray-600 font-medium mt-2">{selectedAnalysis?.departement}</p>
          </DialogHeader>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-1/3">Statut</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={selectedAnalysis?.archived ? "secondary" : "default"}>
                      {selectedAnalysis?.archived ? (
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Modal */}
      <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 text-yellow-500 bg-yellow-50 p-4 rounded-full">
              <Archive className="w-8 h-8" />
            </div>
            <DialogTitle>Confirmer l'archivage</DialogTitle>
            <p className="mt-2 text-gray-600">
              Êtes-vous sûr de vouloir archiver{" "}
              <span className="font-bold text-gray-800">{selectedAnalysis?.type_analyse}</span> ?
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

      {/* Restore Confirmation Modal */}
      <Dialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 text-green-500 bg-green-50 p-4 rounded-full">
              <RotateCcw className="w-8 h-8" />
            </div>
            <DialogTitle>Confirmer la restauration</DialogTitle>
            <p className="mt-2 text-gray-600">
              Êtes-vous sûr de vouloir restaurer{" "}
              <span className="font-bold text-gray-800">{selectedAnalysis?.type_analyse}</span> ?
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
    </div >
  )
}
