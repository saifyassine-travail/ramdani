"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Loader2,
  AlertCircle,
  BookOpen,
  ExternalLink,
  User,
  Cake,
  ChevronLeft,
  ChevronRight,
  Library,
} from "lucide-react"
import {
  fetchResearchCases,
  fetchResearchCase,
  LANGUAGE_LABELS,
  SOURCE_LABELS,
  type ResearchCase,
} from "@/lib/research-api"

function sourceBadgeClasses(source: string) {
  return source === "pmc_patients"
    ? "bg-violet-100 text-violet-700 border-violet-200"
    : "bg-amber-100 text-amber-700 border-amber-200"
}

function excerpt(text: string, max = 280) {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + "…"
}

function CaseAttribution({ item }: { item: ResearchCase }) {
  return (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
      <span>
        Source : <span className="font-medium">{SOURCE_LABELS[item.source] ?? item.source}</span>
        {" · Licence "}
        <span className="font-medium">{item.license}</span>
        {" (usage non commercial)"}
      </span>
      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-medium"
        >
          Voir la source <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

export default function ResearchPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedTerm, setDebouncedTerm] = useState("")
  const [language, setLanguage] = useState<string>("all")
  const [source, setSource] = useState<string>("all")
  const [page, setPage] = useState(1)

  const [cases, setCases] = useState<ResearchCase[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedCase, setSelectedCase] = useState<ResearchCase | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const debounceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchTerm])

  // Any filter change resets to page 1
  useEffect(() => {
    setPage(1)
  }, [debouncedTerm, language, source])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchResearchCases({
        term: debouncedTerm || undefined,
        language: language === "all" ? undefined : language,
        source: source === "all" ? undefined : source,
        page,
      })
      setCases(result.data)
      setTotal(result.total)
      setLastPage(result.last_page)
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des cas cliniques")
    } finally {
      setLoading(false)
    }
  }, [debouncedTerm, language, source, page])

  useEffect(() => {
    load()
  }, [load])

  const openCase = async (item: ResearchCase) => {
    setSelectedCase(item)
    setDetailLoading(true)
    try {
      const full = await fetchResearchCase(item.id)
      setSelectedCase(full)
    } catch {
      // keep the list-row version already shown
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 rounded-xl bg-gradient-to-r from-purple-700 to-violet-600 text-white p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <Library className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Bibliothèque de Référence Clinique</h1>
              <p className="text-purple-100 text-sm mt-1">
                Cas cliniques de-identifiés issus de corpus de littérature médicale publique (PMC-Patients, E3C
                Corpus) — utile pour le diagnostic différentiel et la recherche de cas similaires. Ce ne sont{" "}
                <span className="font-semibold">pas</span> des patients réels du cabinet.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
            <Input
              placeholder="Rechercher par mots-clés (symptômes, diagnostic, terme clinique...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              <SelectItem value="pmc_patients">PMC-Patients</SelectItem>
              <SelectItem value="e3c">E3C Corpus</SelectItem>
            </SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Langue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les langues</SelectItem>
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!loading && !error && (
          <p className="text-sm text-gray-500 mb-3">{total.toLocaleString("fr-FR")} cas trouvés</p>
        )}

        {error && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Erreur de chargement</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={load}>Réessayer</Button>
          </div>
        )}

        {loading && !error && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement...
          </div>
        )}

        {!loading && !error && cases.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            Aucun cas ne correspond à cette recherche.
          </div>
        )}

        {!loading && !error && cases.length > 0 && (
          <div className="space-y-3">
            {cases.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md hover:border-purple-300 transition-all"
                onClick={() => openCase(item)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className={sourceBadgeClasses(item.source)}>
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </Badge>
                    <Badge variant="outline">{LANGUAGE_LABELS[item.language] ?? item.language}</Badge>
                    {item.age && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Cake className="h-3 w-3" /> {item.age}
                      </Badge>
                    )}
                    {item.gender && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {item.gender}
                      </Badge>
                    )}
                  </div>
                  {item.title && <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>}
                  <p className="text-sm text-gray-700 leading-relaxed">{excerpt(item.summary_text)}</p>
                  {item.entities && item.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.entities.slice(0, 6).map((ent, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {ent.text}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <CaseAttribution item={item} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} / {lastPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="outline" className={sourceBadgeClasses(selectedCase.source)}>
                    {SOURCE_LABELS[selectedCase.source] ?? selectedCase.source}
                  </Badge>
                  <Badge variant="outline">{LANGUAGE_LABELS[selectedCase.language] ?? selectedCase.language}</Badge>
                  {selectedCase.age && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Cake className="h-3 w-3" /> {selectedCase.age}
                    </Badge>
                  )}
                  {selectedCase.gender && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {selectedCase.gender}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-left">
                  {selectedCase.title || "Cas clinique"}
                </DialogTitle>
              </DialogHeader>

              <div className="whitespace-pre-line text-sm text-gray-800 leading-relaxed">
                {selectedCase.summary_text}
                {detailLoading && <Loader2 className="h-4 w-4 animate-spin inline ml-2" />}
              </div>

              {selectedCase.entities && selectedCase.entities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Entités cliniques repérées</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCase.entities.map((ent, i) => (
                      <Badge key={i} variant="secondary">
                        {ent.text}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <CaseAttribution item={selectedCase} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
