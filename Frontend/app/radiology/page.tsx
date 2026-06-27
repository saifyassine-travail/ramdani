"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Upload,
  ScanLine,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ImageIcon,
  Thermometer,
  Crosshair,
  X,
  Info,
  ZoomIn,
  Copy,
  FileText,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Finding {
  pathologie: string
  code: string
  confiance: number
  pourcentage: string
  severite: "faible" | "modéré" | "élevé"
}

interface AnalysisResult {
  status: "normal" | "anomalie_detectee"
  total_anomalies: number
  findings: Finding[]
  original_image: string
  heatmap_image: string | null
  segmentation_image: string | null
  medsam2_available: boolean
  processing_time_ms: number
  disclaimer: string
}

interface CTResult {
  modality: string
  num_organs: number
  organs: string[]
  overlay_image: string
  slice: number
  processing_time_ms: number
  disclaimer: string
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const AI_SERVER = "http://localhost:8001"

const SEVERITY_STYLE: Record<string, string> = {
  élevé:  "bg-red-100 text-red-700 border-red-200",
  modéré: "bg-orange-100 text-orange-700 border-orange-200",
  faible: "bg-yellow-100 text-yellow-700 border-yellow-200",
}

const SEVERITY_BAR: Record<string, string> = {
  élevé:  "bg-red-500",
  modéré: "bg-orange-400",
  faible: "bg-yellow-400",
}

// Turn the AI findings into a doctor-ready French report (for the patient file).
function generateReport(result: AnalysisResult): string {
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const L: string[] = [
    "COMPTE-RENDU D'ANALYSE RADIOLOGIQUE ASSISTÉE PAR IA",
    `Date : ${date}`,
    "Modalité : Radiographie thoracique",
    "",
    "RÉSULTATS :",
  ]
  if (result.findings.length === 0) {
    L.push("  Aucune anomalie significative détectée par l'analyse automatique.")
  } else {
    result.findings.forEach((f, i) =>
      L.push(`  ${i + 1}. ${f.pathologie} — probabilité ${f.pourcentage}, sévérité ${f.severite}.`),
    )
  }
  L.push("", "CONCLUSION :")
  if (result.findings.length === 0) {
    L.push("  Examen sans particularité à l'analyse IA.")
  } else {
    const top = result.findings[0]
    L.push(`  ${result.total_anomalies} anomalie(s) détectée(s). Élément prédominant : ${top.pathologie} (${top.pourcentage}).`)
    L.push("  Corrélation clinique et avis d'un radiologue qualifié recommandés.")
  }
  L.push("", "⚠ " + result.disclaimer)
  return L.join("\n")
}

// ─────────────────────────────────────────────────────────────────
// Image viewer with zoom
// ─────────────────────────────────────────────────────────────────

function ImageViewer({ src, label }: { src: string; label: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <>
      <div
        className="relative group cursor-zoom-in rounded-lg overflow-hidden bg-black"
        onClick={() => setZoomed(true)}
      >
        <img src={src} alt={label} className="w-full object-contain max-h-[420px]" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
          {label}
        </span>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setZoomed(false)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={src}
            alt={label}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function RadiologyPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<"original" | "heatmap" | "segmentation">("original")
  const [mode, setMode] = useState<"xray" | "ct">("xray")
  const [ctResult, setCtResult] = useState<CTResult | null>(null)
  const [ctPreview, setCtPreview] = useState<string | null>(null)
  const [ctPreviewLoading, setCtPreviewLoading] = useState(false)

  // ── File handling ──────────────────────────────────────────────

  const loadFile = useCallback((f: File) => {
    setResult(null)
    setCtResult(null)
    if (mode === "ct") {
      // CT = NIfTI volume (no in-browser preview). Accept by extension.
      if (!/\.nii(\.gz)?$/i.test(f.name)) {
        toast({ title: "Fichier invalide", description: "Pour le CT, envoyez un volume NIfTI (.nii ou .nii.gz).", variant: "destructive" })
        return
      }
      setFile(f)
      setPreview(null)
      setCtPreview(null)
      // Fast multi-slice montage so the volume is visible right away (no 1-2 min wait).
      setCtPreviewLoading(true)
      const fd = new FormData()
      fd.append("file", f)
      fetch(`${AI_SERVER}/preview-ct`, { method: "POST", body: fd })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.preview_image) setCtPreview(d.preview_image) })
        .catch(() => {})
        .finally(() => setCtPreviewLoading(false))
      return
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Fichier invalide", description: "Veuillez sélectionner une image (JPEG, PNG).", variant: "destructive" })
      return
    }
    setFile(f)
    setActiveTab("original")
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [toast, mode])

  const switchMode = (m: "xray" | "ct") => {
    setMode(m)
    setFile(null)
    setPreview(null)
    setResult(null)
    setCtResult(null)
    setCtPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) loadFile(f)
  }, [loadFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setCtResult(null)
    setCtPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Analysis ───────────────────────────────────────────────────

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    setCtResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const endpoint = mode === "ct" ? "/analyze-ct" : "/analyze"
      const res = await fetch(`${AI_SERVER}${endpoint}`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Erreur serveur")
      }

      const data = await res.json()

      if (mode === "ct") {
        // /analyze-ct returns a job id; poll until done (CPU CT takes minutes,
        // so the upload never blocks — the doctor can keep working).
        const jobId = data.job_id
        let tries = 0
        while (tries++ < 300) {                       // ~15 min safety cap
          await new Promise((r) => setTimeout(r, 3000))
          const jr = await fetch(`${AI_SERVER}/ct-job/${jobId}`)
          if (!jr.ok) throw new Error("Tâche CT introuvable")
          const job = await jr.json()
          if (job.status === "done") {
            setCtResult(job.result as CTResult)
            toast({ title: "Analyse CT terminée", description: `${job.result.num_organs} organe(s) segmenté(s).` })
            break
          }
          if (job.status === "error") throw new Error(job.error || "Échec de l'analyse CT")
          // pending / running -> keep polling
        }
      } else {
        setResult(data as AnalysisResult)
        setActiveTab(data.heatmap_image ? "heatmap" : "original")
        if (data.status === "normal") {
          toast({ title: "Analyse terminée", description: "Aucune anomalie détectée." })
        } else {
          toast({
            title: `${data.total_anomalies} anomalie(s) détectée(s)`,
            description: "Voir les résultats ci-dessous.",
            variant: "destructive",
          })
        }
      }
    } catch (err: any) {
      toast({
        title: "Erreur d'analyse",
        description: err.message?.includes("fetch")
          ? "Impossible de joindre le serveur IA. Assurez-vous que radiology-ai/start.bat est lancé."
          : err.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  const tabs = [
    { key: "original",     label: "Original",    icon: <ImageIcon className="w-4 h-4" />,  available: true },
    { key: "heatmap",      label: "Heatmap",      icon: <Thermometer className="w-4 h-4" />, available: !!result?.heatmap_image },
    { key: "segmentation", label: "Segmentation", icon: <Crosshair className="w-4 h-4" />,  available: !!result?.segmentation_image },
  ] as const

  const activeImage =
    activeTab === "heatmap"      ? result?.heatmap_image      :
    activeTab === "segmentation" ? result?.segmentation_image :
    preview

  // X-ray shows once an image preview exists; CT shows once a NIfTI is selected.
  const hasInput = mode === "ct" ? !!file : !!preview

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            <span className="text-blue-700 border-b border-gray-400 italic">Analyse</span>{" "}
            <span className="text-gray-600">Radiologique IA</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Détection automatique de pathologies sur images radiologiques (Rx, TDM, IRM)
          </p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 px-3 py-1">
          <ScanLine className="w-3 h-3 mr-1" />
          {mode === "ct" ? "TotalSegmentator · CT" : "DenseNet-121 · 18 pathologies"}
        </Badge>
      </div>

      {/* ── Modality toggle ── */}
      <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
        {([["xray", "Radiographie", <ImageIcon key="x" className="w-4 h-4" />],
           ["ct", "Scanner (CT)", <ScanLine key="c" className="w-4 h-4" />]] as const).map(([m, label, icon]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === m ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Left column: upload + image viewer ── */}
        <div className="space-y-4">

          {/* Drop zone */}
          {!hasInput ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                ${dragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"}
              `}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">
                {mode === "ct" ? "Glissez un volume CT (NIfTI) ici" : "Glissez une image ici"}
              </p>
              <p className="text-sm text-gray-400 mt-1">ou cliquez pour sélectionner</p>
              <p className="text-xs text-gray-300 mt-3">
                {mode === "ct" ? "NIfTI · .nii · .nii.gz" : "JPEG · PNG · DICOM · Max 20 MB"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={mode === "ct" ? ".nii,.nii.gz,application/gzip" : "image/*"}
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          ) : mode === "ct" ? (

            /* CT volume + segmentation overlay */
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="py-3 px-4 bg-gray-50 border-b flex flex-row items-center justify-between">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2 truncate">
                  <ScanLine className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{file?.name || "Volume CT"}</span>
                </span>
                <button onClick={clearFile} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent className="p-0 bg-black flex items-center justify-center min-h-[300px]">
                {ctResult ? (
                  <ImageViewer
                    src={`data:image/png;base64,${ctResult.overlay_image}`}
                    label={`Segmentation CT — coupe axiale ${ctResult.slice}`}
                  />
                ) : ctPreview ? (
                  <ImageViewer
                    src={`data:image/png;base64,${ctPreview}`}
                    label="Aperçu du volume CT — cliquez « Analyser » pour segmenter"
                  />
                ) : ctPreviewLoading ? (
                  <div className="text-center text-gray-400 py-16">
                    <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-blue-400" />
                    <p className="text-sm">Chargement de l'aperçu…</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-16">
                    <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Volume prêt — cliquez sur « Analyser le scanner »</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (

            /* Image + tab strip */
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="py-3 px-4 bg-gray-50 border-b flex flex-row items-center justify-between">
                <div className="flex gap-1">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      disabled={!t.available}
                      onClick={() => setActiveTab(t.key)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                        ${activeTab === t.key
                          ? "bg-blue-600 text-white shadow"
                          : t.available
                            ? "text-gray-600 hover:bg-gray-200"
                            : "text-gray-300 cursor-not-allowed"}
                      `}
                    >
                      {t.icon} {t.label}
                      {t.key !== "original" && !t.available && result && (
                        <span className="text-[10px] opacity-60">(n/d)</span>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={clearFile} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent className="p-0 bg-black">
                {activeImage && (
                  <ImageViewer
                    src={
                      activeTab === "original"
                        ? preview!
                        : `data:image/png;base64,${activeImage}`
                    }
                    label={
                      activeTab === "heatmap"
                        ? "Zones d'attention (Grad-CAM)"
                        : activeTab === "segmentation"
                          ? "Segmentation MedSAM2"
                          : file?.name || "Image"
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Analyze button */}
          {hasInput && (
            <Button
              onClick={analyze}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-semibold"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {mode === "ct" ? "Segmentation… (~1-2 min)" : "Analyse en cours…"}</>
              ) : (
                <><ScanLine className="w-5 h-5 mr-2" /> {mode === "ct" ? "Analyser le scanner" : "Analyser l'image"}</>
              )}
            </Button>
          )}

          {/* Legend */}
          {result?.heatmap_image && (
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-4 text-xs text-blue-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Légende des images
                </p>
                <p>
                  <span className="font-medium">Heatmap</span> — zones rouges = régions qui ont influencé le diagnostic (Grad-CAM).
                </p>
                {result.segmentation_image && (
                  <p>
                    <span className="font-medium">Segmentation</span> — contour rouge = délimitation précise de la zone anormale (MedSAM2).
                  </p>
                )}
                {!result.medsam2_available && (
                  <p className="text-blue-600">
                    MedSAM2 non actif. Lancez <code className="bg-blue-100 px-1 rounded">python setup_weights.py</code> pour activer la segmentation.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: findings ── */}
        <div className="space-y-4">

          {/* Loading (CT segmentation can take ~1-2 min on CPU) */}
          {loading && (
            <Card className="min-h-[300px] flex items-center justify-center bg-gray-50 border-dashed">
              <CardContent className="text-center text-gray-500 py-12">
                <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-blue-500" />
                <p className="text-sm">
                  {mode === "ct" ? "Segmentation du scanner en cours… (~1-2 min)" : "Analyse en cours…"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* CT result */}
          {ctResult && !loading && (
            <>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">{ctResult.num_organs} organe(s) segmenté(s)</p>
                    <p className="text-xs text-green-700">Coupe axiale {ctResult.slice} · {ctResult.processing_time_ms} ms</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-gray-700">Organes détectés</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {ctResult.organs.map((o) => (
                    <span key={o} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                      {o}
                    </span>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800 leading-relaxed">
                    <span className="font-semibold block mb-0.5">Avertissement médical</span>
                    {ctResult.disclaimer}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* No result yet */}
          {!result && !ctResult && !loading && (
            <Card className="h-full flex items-center justify-center min-h-[300px] bg-gray-50 border-dashed">
              <CardContent className="text-center text-gray-400 py-12">
                <ScanLine className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Résultats de l'analyse</p>
                <p className="text-sm mt-1">Uploadez une image et cliquez sur "Analyser"</p>
              </CardContent>
            </Card>
          )}

          {/* Loading skeleton */}
          {loading && (
            <Card className="min-h-[300px]">
              <CardHeader>
                <CardTitle className="text-gray-400 text-base flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  Analyse en cours…
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" style={{ opacity: 1 - i * 0.15 }} />
                    <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              {/* Summary card */}
              <Card className={result.status === "normal"
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
              }>
                <CardContent className="p-4 flex items-center gap-4">
                  {result.status === "normal" ? (
                    <CheckCircle2 className="w-10 h-10 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-10 h-10 text-red-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`font-semibold text-lg ${result.status === "normal" ? "text-green-700" : "text-red-700"}`}>
                      {result.status === "normal" ? "Aucune anomalie détectée" : `${result.total_anomalies} anomalie(s) détectée(s)`}
                    </p>
                    <p className="text-sm text-gray-500">
                      Temps de traitement : {result.processing_time_ms} ms
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Findings list */}
              {result.findings.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-gray-700">Pathologies détectées</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.findings.map((f, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{f.pathologie}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{f.pourcentage}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-0.5 ${SEVERITY_STYLE[f.severite] || "bg-gray-100 text-gray-600"}`}
                            >
                              {f.severite}
                            </Badge>
                          </div>
                        </div>
                        {/* Confidence bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${SEVERITY_BAR[f.severite] || "bg-gray-400"}`}
                            style={{ width: `${Math.round(f.confiance * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Structured French report */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Compte-rendu
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const report = generateReport(result)
                      navigator.clipboard?.writeText(report).then(
                        () => toast({ title: "Copié", description: "Compte-rendu copié dans le presse-papiers." }),
                        () => toast({ title: "Erreur", description: "Copie impossible.", variant: "destructive" }),
                      )
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copier
                  </Button>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-md p-3 border max-h-72 overflow-y-auto">
                    {generateReport(result)}
                  </pre>
                </CardContent>
              </Card>

              {/* Disclaimer */}
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800 leading-relaxed">
                    <span className="font-semibold block mb-0.5">Avertissement médical</span>
                    {result.disclaimer}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
