"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useMedicaments } from "@/hooks/use-medicaments"
import { useToast } from "@/hooks/use-toast"
import type { Medicament } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Edit, Archive, RotateCcw, X, Save, Pill as Pills, CheckCircle, Loader2, Star } from "lucide-react"

export default function MedicamentsPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
  const [selectedMedicament, setSelectedMedicament] = useState<Medicament | null>(null)
  const [editingMedicament, setEditingMedicament] = useState<Medicament | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    dosage: "",
    composition: "",
  })

  const { medicaments, searchMedicaments, createMedicament, updateMedicament, toggleArchiveStatus, toggleFavorite, loading, error } =
    useMedicaments(showArchived)

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
          await searchMedicaments(term)
        } finally {
          setIsSearching(false)
        }
      }
    },
    [searchMedicaments],
  )

  useEffect(() => {
    handleDebouncedSearch(debouncedSearchQuery)
  }, [debouncedSearchQuery, handleDebouncedSearch])

  const filteredMedicaments = useMemo(() => {
    let list = medicaments.filter((medicament) => (showArchived ? medicament.archived : !medicament.archived))
    if (debouncedSearchQuery.trim()) {
      list = list.filter((m) => m.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
    }
    return [...list].sort((a, b) => {
      const aFav = a.is_favorite ? 1 : 0
      const bFav = b.is_favorite ? 1 : 0
      return bFav - aFav
    })
  }, [medicaments, debouncedSearchQuery, showArchived])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleAddMedicament = useCallback(() => {
    setEditingMedicament(null)
    setFormData({ name: "", price: "", description: "", dosage: "", composition: "" })
    setIsModalOpen(true)
  }, [])

  const handleEditMedicament = useCallback((medicament: Medicament) => {
    setEditingMedicament(medicament)
    setFormData({
      name: medicament.name,
      price: medicament.price.toString(),
      description: medicament.description || "",
      dosage: medicament.dosage || "",
      composition: medicament.composition || "",
    })
    setIsModalOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)

      try {
        const medicamentData = {
          name: formData.name,
          price: Number.parseFloat(formData.price),
          description: formData.description,
          dosage: formData.dosage,
          composition: formData.composition,
        }

        let result
        if (editingMedicament) {
          result = await updateMedicament(editingMedicament.ID_Medicament, medicamentData)
        } else {
          result = await createMedicament(medicamentData)
        }

        if (result.success) {
          setIsModalOpen(false)
          setFormData({ name: "", price: "", description: "", dosage: "", composition: "" })
        } else {
          console.error("Failed to save medicament:", result.message)
        }
      } catch (err) {
        console.error("Error saving medicament:", err)
      } finally {
        setSubmitting(false)
      }
    },
    [editingMedicament, formData, createMedicament, updateMedicament],
  )

  const handleArchive = useCallback((medicament: Medicament) => {
    setSelectedMedicament(medicament)
    setIsArchiveModalOpen(true)
  }, [])

  const handleRestore = useCallback((medicament: Medicament) => {
    setSelectedMedicament(medicament)
    setIsRestoreModalOpen(true)
  }, [])

  const confirmArchive = useCallback(async () => {
    if (selectedMedicament) {
      await toggleArchiveStatus(selectedMedicament.ID_Medicament)
    }
    setIsArchiveModalOpen(false)
    setSelectedMedicament(null)
  }, [selectedMedicament, toggleArchiveStatus])

  const confirmRestore = useCallback(async () => {
    if (selectedMedicament) {
      await toggleArchiveStatus(selectedMedicament.ID_Medicament)
    }
    setIsRestoreModalOpen(false)
    setSelectedMedicament(null)
  }, [selectedMedicament, toggleArchiveStatus])

  const handleRowClick = useCallback((medicament: Medicament) => {
    setSelectedMedicament(medicament)
    setIsDetailsModalOpen(true)
  }, [])

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">
          <span className="text-blue-700 border-b border-gray-600 italic">Liste</span>{" "}
          <span className="text-gray-600">des Médicaments</span>
        </h1>

        <div className="flex flex-col w-full md:flex-row md:items-center gap-4">
          <div className="flex gap-2 mr-4">
            <Button
              variant={!showArchived ? "default" : "outline"}
              size="sm"
              onClick={() => setShowArchived(false)}
              className="text-xs"
            >
              <Pills className="w-3 h-3 mr-1" />
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
              placeholder="Rechercher un médicament..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-10"
              autoComplete="off"
            />
          </div>

          <Button onClick={handleAddMedicament} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Médicament
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
              <TableHead className="text-blue-700 font-bold">Code</TableHead>
              <TableHead className="text-blue-700 font-bold">Nom</TableHead>
              <TableHead className="text-blue-700 font-bold">Prix (DH)</TableHead>
              {showArchived && <TableHead className="text-blue-700 font-bold">Statut</TableHead>}
              <TableHead className="text-blue-700 font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showArchived ? 6 : 5} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2">Chargement des médicaments...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredMedicaments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showArchived ? 6 : 5} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Pills className="w-12 h-12 text-blue-300 mb-2" />
                    <p className="text-gray-500">Aucun médicament {showArchived ? "archivé" : ""} trouvé</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredMedicaments.map((medicament) => (
                <TableRow
                  key={medicament.ID_Medicament}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRowClick(medicament)}
                >
                  <TableCell className="pr-0">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const result = await toggleFavorite(medicament.ID_Medicament)
                        if (result && !result.success) {
                          toast({ title: "Erreur", description: result.message, variant: "destructive" })
                        }
                      }}
                      className="p-1 rounded hover:bg-yellow-50 transition-colors"
                      title={medicament.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      <Star className={`w-4 h-4 ${medicament.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`} />
                    </button>
                  </TableCell>
                  <TableCell>{medicament.ID_Medicament}</TableCell>
                  <TableCell className="font-medium">{medicament.name}</TableCell>
                  <TableCell>{Number(medicament.price || 0).toFixed(2)}</TableCell>
                  {showArchived && (
                    <TableCell>
                      <Badge variant={medicament.archived ? "secondary" : "default"}>
                        {medicament.archived ? (
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
                      {!medicament.archived ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditMedicament(medicament)
                            }}
                            className="w-8 h-8 p-0 bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleArchive(medicament)
                            }}
                            className="w-8 h-8 p-0 bg-gray-500 text-white hover:bg-gray-600"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore(medicament)
                          }}
                          className="w-8 h-8 p-0 bg-green-600 text-white hover:bg-green-700"
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMedicament ? "Modifier un Médicament" : "Ajouter un Médicament"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nom*</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nom du médicament"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description du médicament"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="price">Prix*</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="Prix en dirhams"
                required
              />
            </div>
            <div>
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage}
                onChange={(e) => setFormData((prev) => ({ ...prev, dosage: e.target.value }))}
                placeholder="Ex: 500mg, 10mg/ml"
              />
            </div>
            <div>
              <Label htmlFor="composition">Composition</Label>
              <Textarea
                id="composition"
                value={formData.composition}
                onChange={(e) => setFormData((prev) => ({ ...prev, composition: e.target.value }))}
                placeholder="Principes actifs et excipients"
                rows={2}
              />
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

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600">{selectedMedicament?.name}</DialogTitle>
            <p className="text-sm text-gray-500">
              Code: <span className="font-medium text-gray-700">{selectedMedicament?.ID_Medicament}</span>
            </p>
            <p className="text-xl font-bold text-gray-600 mt-2">
              {Number(selectedMedicament?.price || 0).toFixed(2)} DH
            </p>
          </DialogHeader>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-1/3">Dosage</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{selectedMedicament?.dosage || "Non spécifié"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-1/3">Composition</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {selectedMedicament?.composition || "Non spécifié"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-1/3">Description</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {selectedMedicament?.description || "Non spécifié"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-1/3">Statut</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={selectedMedicament?.archived ? "secondary" : "default"}>
                      {selectedMedicament?.archived ? (
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

      <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 text-yellow-500 bg-yellow-50 p-4 rounded-full">
              <Archive className="w-8 h-8" />
            </div>
            <DialogTitle>Confirmer l'archivage</DialogTitle>
            <p className="mt-2 text-gray-600">
              Êtes-vous sûr de vouloir archiver{" "}
              <span className="font-bold text-gray-800">{selectedMedicament?.name}</span> ?
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
              <span className="font-bold text-gray-800">{selectedMedicament?.name}</span> ?
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
