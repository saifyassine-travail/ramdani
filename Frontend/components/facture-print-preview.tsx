"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Printer, X, Type, Calendar, Table2, Coins, AlignLeft, ChevronUp, ChevronDown } from "lucide-react"

const MM_TO_PX = 96 / 25.4
const DISPLAY_W = 540

type ElId = "patient_name" | "date" | "acts_table" | "totals" | "footer"

interface El {
  x: number
  y: number
  fontSize: number
}

interface Paper {
  type?: string
  width: number
  height: number
}

export interface FactureHeaderInfo {
  practiceName?: string
  specialization?: string
  address?: string
  phone?: string
  city?: string
}

interface FacturePrintPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout: any | null
  background: string | null
  patientName: string
  dateStr: string
  acts: { name: string; price: number }[]
  total: number
  header: FactureHeaderInfo
}

const DEFAULTS: Record<ElId, El> = {
  patient_name: { x: 10, y: 24, fontSize: 16 },
  date: { x: 68, y: 24, fontSize: 14 },
  acts_table: { x: 10, y: 34, fontSize: 14 },
  totals: { x: 55, y: 70, fontSize: 14 },
  footer: { x: 10, y: 92, fontSize: 12 },
}

const ELEMENT_META: { id: ElId; label: string; icon: any }[] = [
  { id: "patient_name", label: "Nom Patient", icon: Type },
  { id: "date", label: "Date", icon: Calendar },
  { id: "acts_table", label: "Tableau des Actes", icon: Table2 },
  { id: "totals", label: "Total (en lettres)", icon: Coins },
  { id: "footer", label: "Pied de page", icon: AlignLeft },
]

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function actsTableHTML(acts: { name: string; price: number }[], total: number): string {
  // Only bill acts that actually have a price — 0 DH acts are not shown.
  const billable = acts.filter((a) => Number(a.price) > 0)
  const rows = billable.length
    ? billable
        .map(
          (a) =>
            `<tr><td style="border:1px solid #333;padding:4px 8px">${escapeHtml(a.name)}</td><td style="border:1px solid #333;padding:4px 8px;text-align:right">${a.price} DH</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="border:1px solid #333;padding:4px 8px;color:#999">Aucun acte enregistré</td></tr>`
  const totalRow = `<tr>
      <td style="border:1px solid #333;padding:4px 8px;text-align:right;font-weight:bold;background:#f3f4f6">Total</td>
      <td style="border:1px solid #333;padding:4px 8px;text-align:right;font-weight:bold;background:#f3f4f6">${total} DH</td>
    </tr>`
  return `<table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th style="border:1px solid #333;padding:4px 8px;text-align:left;background:#f3f4f6">Désignation</th>
      <th style="border:1px solid #333;padding:4px 8px;text-align:right;background:#f3f4f6">Prix (DH)</th>
    </tr></thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>`
}

// Write an integer amount (0..999999) in French words, e.g. 250 -> "deux cent cinquante".
function numberToFrenchWords(value: number): string {
  let n = Math.floor(Math.abs(value))
  if (n === 0) return "zéro"
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"]
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"]
  const below100 = (x: number): string => {
    if (x < 20) return units[x]
    const t = Math.floor(x / 10)
    const u = x % 10
    if (t === 7 || t === 9) {
      const base = t === 7 ? "soixante" : "quatre-vingt"
      if (t === 7 && u === 1) return "soixante et onze"
      return base + "-" + units[10 + u]
    }
    if (u === 0) return t === 8 ? "quatre-vingts" : tens[t]
    if (u === 1 && t >= 2 && t <= 6) return tens[t] + " et un"
    return tens[t] + "-" + units[u]
  }
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100)
    const r = x % 100
    let s = ""
    if (h > 0) {
      s = (h > 1 ? units[h] + " " : "") + "cent"
      if (h > 1 && r === 0) s += "s"
    }
    if (r > 0) s = (s ? s + " " : "") + below100(r)
    return s
  }
  let result = ""
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  if (thousands > 0) result += (thousands > 1 ? below1000(thousands) + " mille" : "mille") + " "
  if (rest > 0) result += below1000(rest)
  return result.trim()
}

function totalsHTML(total: number): string {
  const words = numberToFrenchWords(total)
  const dh = total > 1 ? "dirhams" : "dirham"
  return `<div>Arrêtée la présente facture à la somme de :</div>
    <div style="margin-top:2px;text-transform:capitalize"><strong>${escapeHtml(words)} ${dh}</strong></div>`
}

function footerHTML(header: FactureHeaderInfo, dateStr: string): string {
  const city = header.city ? `${escapeHtml(header.city)} — ` : ""
  return `<div>${city}Facture établie le ${escapeHtml(dateStr)}</div>`
}

function buildPrintHTML(
  els: Record<ElId, El>,
  paper: Paper,
  background: string | null,
  patientName: string,
  dateStr: string,
  acts: { name: string; price: number }[],
  total: number,
  header: FactureHeaderInfo,
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Facture - ${escapeHtml(patientName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }
    body { font-family: Arial, sans-serif; }
    .page {
      position: relative;
      width: ${paper.width}mm; height: ${paper.height}mm;
      background-color: #fff;
      background-image: ${background ? `url('${background}')` : "none"};
      background-size: cover; background-repeat: no-repeat; background-position: center;
      overflow: hidden;
    }
    .element { position: absolute; color: #000; }
    .line { transform: translate(0, -50%); white-space: nowrap; }
    @media screen {
      body { background: #eee; display: flex; justify-content: center; padding: 20px; }
      .page { box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    }
    @media print {
      html, body { width: ${paper.width}mm; height: ${paper.height}mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="element line" style="left:${els.patient_name.x}%; top:${els.patient_name.y}%; font-size:${els.patient_name.fontSize}px;">${escapeHtml(patientName)}</div>
    <div class="element line" style="left:${els.date.x}%; top:${els.date.y}%; font-size:${els.date.fontSize}px;">${escapeHtml(dateStr)}</div>
    <div class="element" style="left:${els.acts_table.x}%; top:${els.acts_table.y}%; font-size:${els.acts_table.fontSize}px; width:${100 - els.acts_table.x - 8}%;">${actsTableHTML(acts, total)}</div>
    <div class="element" style="left:${els.totals.x}%; top:${els.totals.y}%; font-size:${els.totals.fontSize}px; line-height:1.5; width:${100 - els.totals.x - 8}%;">${totalsHTML(total)}</div>
    <div class="element" style="left:${els.footer.x}%; top:${els.footer.y}%; font-size:${els.footer.fontSize}px;">${footerHTML(header, dateStr)}</div>
  </div>
</body>
</html>`
}

export default function FacturePrintPreview({
  open,
  onOpenChange,
  layout,
  background,
  patientName,
  dateStr,
  acts,
  total,
  header,
}: FacturePrintPreviewProps) {
  const [els, setEls] = useState<Record<ElId, El>>(DEFAULTS)
  const [paper, setPaper] = useState<Paper>({ type: "A4", width: 210, height: 297 })
  const [selectedId, setSelectedId] = useState<ElId | null>(null)
  const [dragging, setDragging] = useState(false)
  const [bgUrl, setBgUrl] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const L = layout || {}
    const seeded = {} as Record<ElId, El>
    ;(Object.keys(DEFAULTS) as ElId[]).forEach((id) => {
      seeded[id] = {
        x: L[id]?.x ?? DEFAULTS[id].x,
        y: L[id]?.y ?? DEFAULTS[id].y,
        fontSize: L[id]?.fontSize ?? DEFAULTS[id].fontSize,
      }
    })
    setEls(seeded)
    setPaper(L.paper || { type: "A4", width: 210, height: 297 })
    setSelectedId(null)
  }, [open, layout])

  useEffect(() => {
    if (!open || !background) {
      setBgUrl(null)
      return
    }
    let active = true
    let objectUrl: string | null = null
    ;(async () => {
      try {
        const token = localStorage.getItem("auth_token") || ""
        const res = await fetch(background, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error("bg fetch failed")
        const blob = await res.blob()
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setBgUrl(objectUrl)
      } catch {
        if (active) setBgUrl(null)
      }
    })()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, background])

  const pageWpx = paper.width * MM_TO_PX
  const pageHpx = paper.height * MM_TO_PX
  const scale = DISPLAY_W / pageWpx

  const updateSelectedFromPointer = (clientX: number, clientY: number) => {
    if (!selectedId) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100))
    setEls((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], x, y } }))
  }

  const startDrag = (id: ElId) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedId(id)
    setDragging(true)
  }

  const bumpFont = (delta: number) => {
    if (!selectedId) return
    setEls((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], fontSize: Math.max(6, prev[selectedId].fontSize + delta) },
    }))
  }

  const setFont = (value: number) => {
    if (!selectedId) return
    setEls((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], fontSize: Math.max(6, value || 6) } }))
  }

  const handlePrint = () => {
    const html = buildPrintHTML(els, paper, background, patientName, dateStr, acts, total, header)

    const old = document.getElementById("facture-print-frame")
    if (old) old.remove()

    const iframe = document.createElement("iframe")
    iframe.id = "facture-print-frame"
    iframe.setAttribute("style", "position:fixed;right:0;bottom:0;width:0;height:0;border:0;")
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()

    let printed = false
    const doPrint = () => {
      if (printed) return
      printed = true
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        /* ignore */
      }
      setTimeout(() => iframe.remove(), 2000)
    }

    iframe.onload = () => setTimeout(doPrint, 300)
    setTimeout(doPrint, 800)
  }

  const renderElement = (id: ElId) => {
    const el = els[id]
    const selected = selectedId === id
    const common: React.CSSProperties = {
      position: "absolute",
      left: `${el.x}%`,
      top: `${el.y}%`,
      cursor: dragging && selected ? "grabbing" : "grab",
      outline: selected ? "2px solid #2563eb" : "1px dashed rgba(37,99,235,0.35)",
      outlineOffset: "2px",
      fontFamily: "Arial, sans-serif",
    }

    if (id === "acts_table") {
      return (
        <div
          key={id}
          onMouseDown={startDrag(id)}
          style={{ ...common, fontSize: `${el.fontSize}px`, width: `${100 - el.x - 8}%` }}
          dangerouslySetInnerHTML={{ __html: actsTableHTML(acts, total) }}
        />
      )
    }
    if (id === "totals") {
      return (
        <div
          key={id}
          onMouseDown={startDrag(id)}
          style={{ ...common, fontSize: `${el.fontSize}px`, lineHeight: 1.5, width: `${100 - el.x - 8}%` }}
          dangerouslySetInnerHTML={{ __html: totalsHTML(total) }}
        />
      )
    }
    if (id === "footer") {
      return (
        <div
          key={id}
          onMouseDown={startDrag(id)}
          style={{ ...common, fontSize: `${el.fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: footerHTML(header, dateStr) }}
        />
      )
    }
    return (
      <div
        key={id}
        onMouseDown={startDrag(id)}
        style={{ ...common, transform: "translate(0, -50%)", fontSize: `${el.fontSize}px`, whiteSpace: "nowrap" }}
      >
        {id === "patient_name" ? patientName : dateStr}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aperçu de la facture</DialogTitle>
          <p className="text-sm text-gray-500">
            Glissez les éléments pour les repositionner et ajustez la taille. Ces modifications sont temporaires
            (elles ne changent pas vos réglages).
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex justify-center bg-gray-100 rounded-xl p-4 select-none">
            <div
              ref={wrapperRef}
              onMouseDown={() => setSelectedId(null)}
              onMouseMove={(e) => {
                if (dragging) updateSelectedFromPointer(e.clientX, e.clientY)
              }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              style={{ width: DISPLAY_W, height: pageHpx * scale, position: "relative" }}
            >
              <div
                style={{
                  width: pageWpx,
                  height: pageHpx,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  position: "relative",
                  background: bgUrl ? `#fff url('${bgUrl}') center/cover no-repeat` : "#fff",
                  boxShadow: "0 0 10px rgba(0,0,0,0.15)",
                }}
              >
                {(Object.keys(DEFAULTS) as ElId[]).map((id) => renderElement(id))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="space-y-2">
              {ELEMENT_META.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedId === id ? "border-blue-500 bg-blue-50 shadow-sm" : "hover:bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${selectedId === id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-sm block">{label}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {Math.round(els[id].x)}%, {Math.round(els[id].y)}% · {els[id].fontSize}px
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedId && (
              <div className="pt-3 border-t space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600">Taille du texte</h4>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={els[selectedId].fontSize}
                    onChange={(e) => setFont(parseInt(e.target.value))}
                    className="h-10 text-center font-bold"
                  />
                  <Button variant="secondary" className="h-10" onClick={() => bumpFont(1)}>
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary" className="h-10" onClick={() => bumpFont(-1)}>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
              Format: {paper.type || "A4"} ({paper.width}×{paper.height} mm). Cliquez un élément puis glissez-le sur la
              page.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700 h-11">
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
