"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useMedicaments } from "@/hooks/use-medicaments"
import { useToast } from "@/hooks/use-toast"
import { apiClient, type Medicament, type RegimeCoverage } from "@/lib/api"
import MedicamentReferencePanel, { RegimeTag } from "@/components/medicament-reference-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Edit, Archive, RotateCcw, X, Save, Pill as Pills, CheckCircle, Loader2, Star, ChevronLeft, ChevronRight, SlidersHorizontal, Rows3, Rows4 } from "lucide-react"

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
    prix_hospitalier: "",
    dosage: "",
    composition: "",
    type: "",
    type_category: "",
    laboratory: "",
    statut: "",
  })

  const {
    medicaments,
    searchMedicaments,
    createMedicament,
    updateMedicament,
    toggleArchiveStatus,
    toggleFavorite,
    fetchMedicaments,
    currentPage,
    totalPages,
    total,
    loading,
    error,
  } = useMedicaments(showArchived)

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

  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      let active = true
      setIsSearching(true)
      searchMedicaments(debouncedSearchQuery).finally(() => {
        if (active) setIsSearching(false)
      })
      return () => {
        active = false
      }
    }
    // No search term: load the (paginated) full list, page 1.
    fetchMedicaments(1)
  }, [debouncedSearchQuery, searchMedicaments, fetchMedicaments])

  // ── Colonnes configurables ──────────────────────────────────────────
  // Le tableau sert à des usages très différents (prescrire, comparer un prix,
  // vérifier une prise en charge) : chaque praticien choisit ce qu'il affiche.
  const COLUMNS = useMemo(
    () => [
      { key: "code", label: "Code", always: false },
      { key: "name", label: "Nom", always: true },
      { key: "dosage", label: "Dosage", always: false },
      { key: "form", label: "Forme", always: false },
      { key: "composition", label: "Composition (DCI)", always: false },
      { key: "laboratory", label: "Laboratoire", always: false },
      { key: "classe", label: "Classe thérapeutique", always: false },
      { key: "price", label: "PPV", always: false },
      { key: "ph", label: "Prix hospitalier", always: false },
      { key: "remb", label: "Remboursement", always: false },
    ] as const,
    [],
  )
  type ColKey = (typeof COLUMNS)[number]["key"]

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    code: false, name: true, dosage: true, form: true, composition: true,
    laboratory: false, classe: false, price: true, ph: false, remb: true,
  })
  const [colsOpen, setColsOpen] = useState(false)
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable")
  const [sort, setSort] = useState<{ key: ColKey | "favorite"; dir: 1 | -1 }>({
    key: "favorite", dir: 1,
  })

  // Préférences praticien (Réglages → Affichage)
  const [prefs, setPrefs] = useState({ separate_dosage: false, show_reimbursement: true })
  useEffect(() => {
    apiClient
      .getUserSettings?.()
      .then((r: any) => {
        const s = r?.data ?? r?.settings ?? r
        if (s) {
          setPrefs({
            separate_dosage: !!s.separate_dosage,
            show_reimbursement: s.show_reimbursement !== false,
          })
        }
      })
      .catch(() => {})
  }, [])

  /**
   * « AMOXIL 1 G » → { brand: "AMOXIL", dosage: "1 G" }.
   * Le nom de marque vient de la base nationale quand il est connu ; sinon on
   * retire le dosage du libellé, ce qui couvre les produits saisis à la main.
   */
  const splitName = useCallback((m: Medicament) => {
    const label = (m.name || "").replace(/,\s*[^,]*$/, "").trim()
    const brand =
      m.brand?.trim() ||
      label.replace(/\s+\d[\d.,]*\s*(MG|G|UG|µG|MCG|ML|UI|%).*$/i, "").trim() ||
      label
    const dosage = m.dosage?.trim() || label.slice(brand.length).trim()
    return { brand, dosage }
  }, [])

  const sortValue = useCallback(
    (m: Medicament, key: ColKey | "favorite") => {
      switch (key) {
        case "favorite": return m.is_favorite ? 1 : 0
        case "code": return m.ID_Medicament
        case "name": return splitName(m).brand.toLowerCase()
        case "dosage": return splitName(m).dosage.toLowerCase()
        case "form": return (m.type || "").toLowerCase()
        case "composition": return (m.composition || "").toLowerCase()
        case "laboratory": return (m.laboratory || "").toLowerCase()
        case "classe": return (m["Classe_thérapeutique"] || "").toLowerCase()
        case "price": return m.price == null ? -1 : Number(m.price)
        case "ph": return m.prix_hospitalier == null ? -1 : Number(m.prix_hospitalier)
        default: return 0
      }
    },
    [splitName],
  )

  const filteredMedicaments = useMemo(() => {
    let list = medicaments.filter((medicament) => (showArchived ? medicament.archived : !medicament.archived))
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.composition || "").toLowerCase().includes(q) ||
          (m.laboratory || "").toLowerCase().includes(q) ||
          (m["Classe_thérapeutique"] || "").toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      // Les favoris restent en tête quel que soit le tri demandé.
      const fav = (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)
      if (sort.key !== "favorite" && fav !== 0) return fav
      const x = sortValue(a, sort.key)
      const y = sortValue(b, sort.key)
      if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir
      return String(x).localeCompare(String(y), "fr", { numeric: true }) * sort.dir
    })
  }, [medicaments, debouncedSearchQuery, showArchived, sort, sortValue])

  const toggleSort = useCallback((key: ColKey) => {
    setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }))
  }, [])

  const shownCols = useMemo(
    () => COLUMNS.filter((c) => c.always || visibleCols[c.key]),
    [COLUMNS, visibleCols],
  )
  const cellPad = density === "compact" ? "py-1.5" : "py-3"

  // Prise en charge de la page affichée, en une seule requête.
  const [coverage, setCoverage] = useState<Record<string, RegimeCoverage>>({})
  const [refAvailable, setRefAvailable] = useState(true)
  useEffect(() => {
    if (!prefs.show_reimbursement || filteredMedicaments.length === 0) return
    let alive = true
    apiClient
      .getMedicamentCoverage(filteredMedicaments.map((m) => m.ID_Medicament))
      .then((r) => {
        if (!alive) return
        setRefAvailable(r.available !== false)
        setCoverage(r.coverage || {})
      })
      .catch(() => {})
    return () => { alive = false }
  }, [filteredMedicaments, prefs.show_reimbursement])

  const SortMark = ({ dir }: { dir: 1 | -1 }) => (
    <span className="ml-1 text-blue-500">{dir === 1 ? "▲" : "▼"}</span>
  )

  /** Pastilles CNSS / CNOPS d'une ligne, depuis la prise en charge déjà chargée. */
  const RemboursementCell = ({ id }: { id: number }) => {
    const c = coverage[String(id)]
    if (!refAvailable) return <span className="text-xs text-gray-400">—</span>
    if (!c) return <span className="text-xs text-gray-300">Non listé</span>
    return (
      <div className="flex flex-wrap gap-1">
        {(["CNSS", "CNOPS"] as const).map((r) =>
          c[r] ? (
            <RegimeTag key={r} regime={r} remboursable={!!c[r]?.remboursable} taux={c[r]?.taux} />
          ) : null,
        )}
      </div>
    )
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const emptyForm = {
    name: "", price: "", prix_hospitalier: "", dosage: "", composition: "",
    type: "", type_category: "", laboratory: "", statut: "",
  }

  const handleAddMedicament = useCallback(() => {
    setEditingMedicament(null)
    setFormData(emptyForm)
    setIsModalOpen(true)
  }, [])

  const handleEditMedicament = useCallback((medicament: Medicament) => {
    setEditingMedicament(medicament)
    setFormData({
      name: medicament.name || "",
      price: medicament.price != null ? medicament.price.toString() : "",
      prix_hospitalier: medicament.prix_hospitalier != null ? medicament.prix_hospitalier.toString() : "",
      dosage: medicament.dosage || "",
      composition: medicament.composition || "",
      type: medicament.type || "",
      type_category: medicament.type_category || "",
      laboratory: medicament.laboratory || "",
      statut: medicament.statut || "",
    })
    setIsModalOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)

      try {
        const parseOptionalNumber = (v: string) => v.trim() !== "" ? Number.parseFloat(v) : null
        const medicamentData = {
          name: formData.name,
          price: parseOptionalNumber(formData.price),
          prix_hospitalier: parseOptionalNumber(formData.prix_hospitalier),
          dosage: formData.dosage || undefined,
          composition: formData.composition || undefined,
          type: formData.type || undefined,
          type_category: formData.type_category || undefined,
          laboratory: formData.laboratory || undefined,
          statut: formData.statut || undefined,
        }

        let result
        if (editingMedicament) {
          result = await updateMedicament(editingMedicament.ID_Medicament, medicamentData)
        } else {
          result = await createMedicament(medicamentData)
        }

        if (result.success) {
          setIsModalOpen(false)
          setFormData(emptyForm)
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
    <div className="p-6 max-w-7xl mx-auto">
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

      {/* Barre d'outils du tableau : colonnes affichées et densité. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColsOpen((o) => !o)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Colonnes
            <span className="ml-1 rounded bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-600">
              {shownCols.length}
            </span>
          </Button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setColsOpen(false)} />
              <div className="absolute left-0 top-10 z-20 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                {COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 ${
                      c.always ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={c.always}
                      checked={c.always || !!visibleCols[c.key]}
                      onChange={(e) =>
                        setVisibleCols((v) => ({ ...v, [c.key]: e.target.checked }))
                      }
                      className="accent-blue-600"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
          className="gap-1.5"
          title="Densité des lignes"
        >
          {density === "compact" ? <Rows4 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
          {density === "compact" ? "Compact" : "Confortable"}
        </Button>

        {sort.key !== "favorite" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSort({ key: "favorite", dir: 1 })}
            className="text-gray-500"
          >
            Réinitialiser le tri
          </Button>
        )}

        <span className="ml-auto text-xs text-gray-500">
          {filteredMedicaments.length} sur {total ?? filteredMedicaments.length}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-blue-700 font-bold w-8"></TableHead>
              {shownCols.map((c) => {
                // Le nom se dédouble en « Marque » + « Dosage » quand le
                // praticien l'a demandé dans Réglages → Affichage.
                if (c.key === "name" && prefs.separate_dosage) {
                  return (
                    <React.Fragment key="name-split">
                      <TableHead
                        className="cursor-pointer select-none font-bold text-blue-700"
                        onClick={() => toggleSort("name")}
                      >
                        Marque{sort.key === "name" && <SortMark dir={sort.dir} />}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none font-bold text-blue-700"
                        onClick={() => toggleSort("dosage")}
                      >
                        Dosage{sort.key === "dosage" && <SortMark dir={sort.dir} />}
                      </TableHead>
                    </React.Fragment>
                  )
                }
                if (c.key === "dosage" && prefs.separate_dosage) return null
                return (
                  <TableHead
                    key={c.key}
                    className={`cursor-pointer select-none font-bold text-blue-700 ${
                      c.key === "price" || c.key === "ph" ? "text-right" : ""
                    }`}
                    onClick={() => c.key !== "remb" && toggleSort(c.key)}
                  >
                    {c.label}
                    {sort.key === c.key && <SortMark dir={sort.dir} />}
                  </TableHead>
                )
              })}
              {showArchived && <TableHead className="text-blue-700 font-bold">Statut</TableHead>}
              <TableHead className="text-blue-700 font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={shownCols.length + (prefs.separate_dosage ? 1 : 0) + (showArchived ? 3 : 2)} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2">Chargement des médicaments...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredMedicaments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={shownCols.length + (prefs.separate_dosage ? 1 : 0) + (showArchived ? 3 : 2)} className="text-center py-8">
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
                  {shownCols.map((c) => {
                    const { brand, dosage } = splitName(medicament)
                    if (c.key === "name" && prefs.separate_dosage) {
                      return (
                        <React.Fragment key="name-split">
                          <TableCell className={`${cellPad} font-medium`}>{brand}</TableCell>
                          <TableCell className={`${cellPad} whitespace-nowrap text-gray-600`}>
                            {dosage || <span className="text-gray-300">—</span>}
                          </TableCell>
                        </React.Fragment>
                      )
                    }
                    if (c.key === "dosage" && prefs.separate_dosage) return null

                    switch (c.key) {
                      case "code":
                        return <TableCell key={c.key} className={`${cellPad} text-gray-500`}>{medicament.ID_Medicament}</TableCell>
                      case "name":
                        return <TableCell key={c.key} className={`${cellPad} font-medium`}>{medicament.name}</TableCell>
                      case "dosage":
                        return (
                          <TableCell key={c.key} className={`${cellPad} whitespace-nowrap text-gray-600`}>
                            {medicament.dosage || <span className="text-gray-300">—</span>}
                          </TableCell>
                        )
                      case "form":
                        return (
                          <TableCell key={c.key} className={cellPad}>
                            {medicament.type_category ? (
                              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700">
                                {medicament.type_category}
                              </Badge>
                            ) : medicament.type ? (
                              <Badge variant="outline" className="border-gray-200 text-xs text-gray-600">
                                {medicament.type}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        )
                      case "composition":
                        return (
                          <TableCell key={c.key} className={`${cellPad} max-w-[220px] truncate text-gray-600`}
                            title={medicament.composition || ""}>
                            {medicament.composition?.split("|").map((s) => s.trim()).join(" + ") || (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                        )
                      case "laboratory":
                        return (
                          <TableCell key={c.key} className={`${cellPad} max-w-[180px] truncate text-gray-600`}
                            title={medicament.laboratory || ""}>
                            {medicament.laboratory || <span className="text-gray-300">—</span>}
                          </TableCell>
                        )
                      case "classe":
                        return (
                          <TableCell key={c.key} className={`${cellPad} max-w-[220px] truncate text-gray-600`}
                            title={medicament["Classe_thérapeutique"] || ""}>
                            {medicament["Classe_thérapeutique"] || <span className="text-gray-300">—</span>}
                          </TableCell>
                        )
                      case "price":
                        return (
                          <TableCell key={c.key} className={`${cellPad} text-right font-mono tabular-nums`}>
                            {medicament.price != null ? Number(medicament.price).toFixed(2) : "—"}
                          </TableCell>
                        )
                      case "ph":
                        return (
                          <TableCell key={c.key} className={`${cellPad} text-right font-mono tabular-nums text-gray-600`}>
                            {medicament.prix_hospitalier != null
                              ? Number(medicament.prix_hospitalier).toFixed(2)
                              : "—"}
                          </TableCell>
                        )
                      case "remb":
                        return (
                          <TableCell key={c.key} className={cellPad}>
                            {prefs.show_reimbursement ? (
                              <RemboursementCell id={medicament.ID_Medicament} />
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        )
                      default:
                        return null
                    }
                  })}
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
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditMedicament(medicament)
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
                              handleArchive(medicament)
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
                            handleRestore(medicament)
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

      {!debouncedSearchQuery.trim() && !loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages} • {total} médicaments
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => fetchMedicaments(currentPage - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => fetchMedicaments(currentPage + 1)}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMedicament ? "Modifier un Médicament" : "Ajouter un Médicament"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nom du médicament"
                required
              />
            </div>

            {/* Prix PPV + Prix hospitalier */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Prix PPV (DH)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="—"
                />
              </div>
              <div>
                <Label htmlFor="prix_hospitalier">Prix hospitalier (DH)</Label>
                <Input
                  id="prix_hospitalier"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_hospitalier}
                  onChange={(e) => setFormData((prev) => ({ ...prev, prix_hospitalier: e.target.value }))}
                  placeholder="—"
                />
              </div>
            </div>

            {/* Forme + Catégorie */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Forme</Label>
                <Input
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                  placeholder="Ex: Comprimé, Sirop"
                />
              </div>
              <div>
                <Label htmlFor="type_category">Catégorie</Label>
                <Input
                  id="type_category"
                  value={formData.type_category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type_category: e.target.value }))}
                  placeholder="Ex: Anti-inflammatoire"
                />
              </div>
            </div>

            {/* Laboratoire + Statut */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="laboratory">Laboratoire</Label>
                <Input
                  id="laboratory"
                  value={formData.laboratory}
                  onChange={(e) => setFormData((prev) => ({ ...prev, laboratory: e.target.value }))}
                  placeholder="Ex: Pfizer, Sanofi"
                />
              </div>
              <div>
                <Label htmlFor="statut">Statut</Label>
                <Input
                  id="statut"
                  value={formData.statut}
                  onChange={(e) => setFormData((prev) => ({ ...prev, statut: e.target.value }))}
                  placeholder="Ex: Commercialisé"
                />
              </div>
            </div>

            {/* Dosage */}
            <div>
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage}
                onChange={(e) => setFormData((prev) => ({ ...prev, dosage: e.target.value }))}
                placeholder="Ex: 500mg, 10mg/ml"
              />
            </div>

            {/* Composition */}
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

            <div className="flex justify-end space-x-3 pt-2">
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
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-blue-600 leading-tight">{selectedMedicament?.name}</DialogTitle>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                Code: <span className="font-medium text-gray-700">{selectedMedicament?.ID_Medicament}</span>
              </p>
              {selectedMedicament?.type_category && (
                <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50">
                  {selectedMedicament.type_category}
                </Badge>
              )}
            </div>
            <div className="flex gap-4 mt-2">
              <div>
                <span className="text-xs text-gray-400">PPV</span>
                <p className="text-lg font-bold text-gray-700">
                  {selectedMedicament?.price != null ? `${Number(selectedMedicament.price).toFixed(2)} DH` : "—"}
                </p>
              </div>
              {selectedMedicament?.prix_hospitalier != null && (
                <div>
                  <span className="text-xs text-gray-400">Prix hospitalier</span>
                  <p className="text-lg font-bold text-blue-600">
                    {Number(selectedMedicament.prix_hospitalier).toFixed(2)} DH
                  </p>
                </div>
              )}
            </div>
          </DialogHeader>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                {selectedMedicament?.type && (
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Forme</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{selectedMedicament.type}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Dosage</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{selectedMedicament?.dosage || "—"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Composition</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {selectedMedicament?.composition
                      ? selectedMedicament.composition.split("|").map((c, i) => (
                          <span key={i} className="block">{c.trim()}</span>
                        ))
                      : "—"}
                  </td>
                </tr>
                {selectedMedicament?.['Classe_thérapeutique'] && (
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Classe thérapeutique</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{selectedMedicament['Classe_thérapeutique']}</td>
                  </tr>
                )}
                {selectedMedicament?.Code_ATCv && (
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Code ATC</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{selectedMedicament.Code_ATCv}</td>
                  </tr>
                )}
                {selectedMedicament?.laboratory && (
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Laboratoire</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{selectedMedicament.laboratory}</td>
                  </tr>
                )}
                {selectedMedicament?.statut && (
                  <tr>
                    <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Statut commercial</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{selectedMedicament.statut}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 w-2/5">Archive</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={selectedMedicament?.archived ? "secondary" : "default"}>
                      {selectedMedicament?.archived ? (
                        <><Archive className="w-3 h-3 mr-1" />Archivé</>
                      ) : (
                        <><CheckCircle className="w-3 h-3 mr-1" />Actif</>
                      )}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Prise en charge CNSS / CNOPS et équivalents, depuis la base
              nationale. Rien ne s'affiche si elle n'est pas installée. */}
          {selectedMedicament && (
            <div className="pt-4">
              <MedicamentReferencePanel
                medicament={selectedMedicament}
                onOpenEquivalent={(name) => {
                  setIsDetailsModalOpen(false)
                  setSearchQuery(name)
                }}
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
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
