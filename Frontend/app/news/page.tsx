"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiClient, type MedicalNewsItem, type NewsSourceStatus } from "@/lib/api"
import { Loader2, RefreshCw, ExternalLink, Search, AlertCircle, Newspaper } from "lucide-react"

/** Une couleur par organisme, pour repérer l'origine d'un article d'un coup d'œil. */
const SOURCE_STYLE: Record<string, { dot: string; chip: string; short: string }> = {
  ANAM:       { dot: "bg-violet-500",  chip: "bg-violet-50 text-violet-700 ring-violet-200",    short: "ANAM" },
  CNSS:       { dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-700 ring-sky-200",             short: "CNSS" },
  SANTE_GOV:  { dot: "bg-indigo-500",  chip: "bg-indigo-50 text-indigo-700 ring-indigo-200",    short: "Min. Santé" },
  OMS:        { dot: "bg-cyan-500",    chip: "bg-cyan-50 text-cyan-700 ring-cyan-200",          short: "OMS Maroc" },
  MEDICAMENT: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", short: "Medicament.ma" },
  MEDIAS24:   { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 ring-amber-200",       short: "Médias24" },
  HESPRESS:   { dot: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 ring-rose-200",          short: "Hespress" },
  MWN:        { dot: "bg-orange-500",  chip: "bg-orange-50 text-orange-700 ring-orange-200",    short: "Morocco World News" },
  JSM:        { dot: "bg-teal-500",    chip: "bg-teal-50 text-teal-700 ring-teal-200",          short: "Journal Santé" },
}
const styleFor = (s: string) =>
  SOURCE_STYLE[s] || { dot: "bg-gray-400", chip: "bg-gray-50 text-gray-600 ring-gray-200", short: s }

const KIND_ORDER = ["Officiel", "Spécialisé", "Presse"]

const fmtDate = (iso: string | null) => {
  if (!iso) return "Date inconnue"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Date inconnue"
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

/** « il y a 3 jours » — plus parlant qu'une date pour juger de la fraîcheur. */
const relative = (iso: string | null) => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return "hier"
  if (days < 31) return `il y a ${days} jours`
  const months = Math.floor(days / 30)
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`
}

export default function NewsPage() {
  const [items, setItems] = useState<MedicalNewsItem[]>([])
  const [sources, setSources] = useState<Record<string, NewsSourceStatus>>({})
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [activeKind, setActiveKind] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const r = await apiClient.getMedicalNews(refresh)
      setItems(r.items)
      setSources(r.sources)
      setFetchedAt(r.fetched_at)
      if (r.items.length === 0) {
        setError("Aucune actualité récupérée. Les sites sources sont peut-être injoignables.")
      }
    } catch {
      setError("Impossible de récupérer les actualités.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (activeSource && i.source !== activeSource) return false
      if (activeKind && (i.source_kind || sources[i.source]?.kind) !== activeKind) return false
      if (!q) return true
      return (
        i.title.toLowerCase().includes(q) ||
        (i.summary || "").toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        i.source_label.toLowerCase().includes(q)
      )
    })
  }, [items, query, activeSource, activeKind, sources])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const i of items) c[i.source] = (c[i.source] || 0) + 1
    return c
  }, [items])

  /** Les sources rangées par nature, l'officiel d'abord. */
  const grouped = useMemo(() => {
    const g: Record<string, [string, NewsSourceStatus][]> = {}
    for (const [code, s] of Object.entries(sources)) {
      const k = s.kind || "Autre"
      ;(g[k] ||= []).push([code, s])
    }
    return KIND_ORDER.filter((k) => g[k]).map((k) => [k, g[k]] as const)
  }, [sources])

  const failing = Object.values(sources).filter((s) => !s.ok).length

  return (
    <div className="nw-page flex h-full flex-col overflow-hidden bg-gray-50/50">
      {/* En-tête */}
      <header className="flex-none border-b border-gray-200 bg-white px-6 pb-3 pt-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight text-gray-900">
              <Newspaper className="h-5 w-5 text-primary" />
              Actualités médicales
            </h1>
            <p className="mt-1 text-[13px] text-gray-500">
              {Object.keys(sources).length} sources marocaines — officielles et presse spécialisée
              {fetchedAt && (
                <span className="text-gray-400"> · relevé {relative(fetchedAt) ?? "à l'instant"}</span>
              )}
              {failing > 0 && (
                <span className="text-amber-600"> · {failing} source(s) injoignable(s)</span>
              )}
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {/* Filtres : d'abord la nature de la source, puis la source précise. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setActiveKind(null); setActiveSource(null) }}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors ${
              !activeKind && !activeSource
                ? "bg-gray-900 text-white ring-gray-900"
                : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            Toutes <span className="font-mono opacity-70">{items.length}</span>
          </button>

          {grouped.map(([kind]) => (
            <button
              key={kind}
              onClick={() => { setActiveKind(activeKind === kind ? null : kind); setActiveSource(null) }}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors ${
                activeKind === kind
                  ? "bg-gray-900 text-white ring-gray-900"
                  : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {kind}
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-gray-200" />

          {Object.entries(sources)
            .filter(([, s]) => !activeKind || s.kind === activeKind)
            .map(([code, s]) => {
              const st = styleFor(code)
              const on = activeSource === code
              return (
                <button
                  key={code}
                  onClick={() => setActiveSource(on ? null : code)}
                  title={s.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors ${
                    on ? "bg-gray-900 text-white ring-gray-900" : `${st.chip} hover:brightness-95`
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-white" : st.dot}`} />
                  {st.short}
                  <span className="font-mono opacity-70">{counts[code] ?? 0}</span>
                  {!s.ok && <AlertCircle className="h-3 w-3 text-red-500" />}
                </button>
              )
            })}

          <label className="relative ml-auto w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans les actualités…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-primary"
            />
          </label>
        </div>
      </header>

      {/* Liste */}
      <div className="nw-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                <div className="nw-skel h-36 w-full" />
                <div className="p-4">
                  <div className="nw-skel h-3 w-24 rounded" />
                  <div className="nw-skel mt-3 h-4 w-full rounded" />
                  <div className="nw-skel mt-2 h-4 w-4/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => load(true)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Réessayer
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            Aucune actualité ne correspond à cette recherche.
          </div>
        ) : (
          <div className="nw-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item, i) => {
              const st = styleFor(item.source)
              return (
                <a
                  key={`${item.source}-${item.url}-${i}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nw-card group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_28px_rgba(20,24,26,0.10)]"
                  style={{ animationDelay: `${Math.min(i, 14) * 45}ms` }}
                >
                  {item.image && (
                    <div className="relative h-36 w-full overflow-hidden bg-gray-100">
                      {/* Vignette de la source ; une image cassée disparaît
                          proprement au lieu d'afficher une icône brisée. */}
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget.parentElement
                          if (el) el.style.display = "none"
                        }}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[10.5px] font-semibold ring-1 ring-inset ${st.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.short}
                      </span>
                      {item.category && item.category !== "Non classé" && (
                        <span className="truncate rounded-md bg-gray-50 px-1.5 py-[3px] text-[10.5px] text-gray-500">
                          {item.category}
                        </span>
                      )}
                      <ExternalLink className="ml-auto h-3.5 w-3.5 flex-none text-gray-300 transition-colors group-hover:text-primary" />
                    </div>

                    <h2 className="text-[14.5px] font-semibold leading-snug text-gray-900 [text-wrap:pretty] group-hover:text-primary">
                      {item.title}
                    </h2>

                    {item.summary && (
                      <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-gray-600">
                        {item.summary}
                      </p>
                    )}

                    <div className="mt-auto flex items-center gap-2 pt-3 text-[11.5px] text-gray-400">
                      <span>{fmtDate(item.published_at)}</span>
                      {relative(item.published_at) && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span>{relative(item.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Provenance : la page dit toujours d'où viennent les informations. */}
      <footer className="flex-none border-t border-gray-200 bg-white px-6 py-2.5">
        <p className="text-[11.5px] leading-relaxed text-gray-400">
          Sources :{" "}
          {Object.entries(sources).map(([code, s], i) => (
            <span key={code}>
              {i > 0 && " · "}
              <a
                href={s.home || items.find((x) => x.source === code)?.source_home || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 underline-offset-2 hover:text-primary hover:underline"
              >
                {s.label}
              </a>
              {!s.ok && <span className="text-red-500"> (injoignable)</span>}
            </span>
          ))}
        </p>
      </footer>
    </div>
  )
}
