"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Printer, X, Type, Calendar, List, ChevronUp, ChevronDown } from "lucide-react"

const MM_TO_PX = 96 / 25.4
const DISPLAY_W = 540 // on-screen width of the previewed page, in px

type ElId = "patient_name" | "date" | "medications"

interface El {
  x: number // %
  y: number // %
  fontSize: number // px
  hidden?: boolean
}

interface Paper {
  type?: string
  width: number // mm
  height: number // mm
}

interface OrdonnancePrintPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout: any | null
  background: string | null
  patientName: string
  dateStr: string
  /** Joined HTML for all medications (name + posology blocks). */
  medicationsHTML: string
}

const DEFAULTS: Record<ElId, El> = {
  patient_name: { x: 10, y: 15, fontSize: 18 },
  date: { x: 70, y: 15, fontSize: 16 },
  medications: { x: 10, y: 30, fontSize: 16 },
}

const ELEMENT_META: { id: ElId; label: string; icon: any }[] = [
  { id: "patient_name", label: "Nom Patient", icon: Type },
  { id: "date", label: "Date", icon: Calendar },
  { id: "medications", label: "Médicaments", icon: List },
]

/**
 * Builds the print HTML. Kept in sync with the on-screen preview so the printout
 * matches what the doctor sees. All font sizes are px (consistent across the
 * three elements and the settings editor).
 */
function buildPrintHTML(
  els: Record<ElId, El>,
  paper: Paper,
  background: string | null,
  patientName: string,
  dateStr: string,
  medicationsHTML: string,
  page2X: number,
  page2Y: number,
) {
  // Vertical positions -> mm so they stay put once the sheet grows past one page.
  const pnTop = ((els.patient_name.y / 100) * paper.height).toFixed(2)
  const dtTop = ((els.date.y / 100) * paper.height).toFixed(2)
  const mdTop = ((els.medications.y / 100) * paper.height).toFixed(2)
  // Where the list resumes on page 2+ (customizable in settings) — position and width.
  const page2Top = ((page2Y / 100) * paper.height).toFixed(2)
  const page2Left = page2X
  const page2Width = 100 - page2X - 5
  const mdLeft = els.medications.x
  const mdWidth = 100 - els.medications.x - 5

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ordonnance - ${patientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }
    body { font-family: Arial, sans-serif; width: ${paper.width}mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Full-bleed letterhead, repeated on every page. */
    .page-bg {
      position: fixed; top: 0; left: 0;
      width: ${paper.width}mm; height: ${paper.height}mm;
      background-image: ${background ? `url('${background}')` : "none"};
      background-size: cover; background-repeat: no-repeat; background-position: center;
      z-index: -1;
    }
    .element { position: absolute; transform: translate(0, -50%); color: #000; }
    /* Medication list starts below the letterhead header; a script inserts page
       breaks so each overflow page also starts below the header (see paginate). */
    #meds { margin-top: ${mdTop}mm; font-size: ${els.medications.fontSize}px; line-height: 1.5; }
    #meds > div { margin-left: ${mdLeft}%; width: ${mdWidth}%; break-inside: avoid; page-break-inside: avoid; }
    @media screen {
      body { background: #eee; }
      .page-bg { position: absolute; }
    }
  </style>
</head>
<body>
  ${background ? '<div class="page-bg"></div>' : ""}
  ${els.patient_name.hidden ? "" : `<div class="element" style="left:${els.patient_name.x}%; top:${pnTop}mm; font-size:${els.patient_name.fontSize}px; white-space:nowrap;">${patientName}</div>`}
  ${els.date.hidden ? "" : `<div class="element" style="left:${els.date.x}%; top:${dtTop}mm; font-size:${els.date.fontSize}px; white-space:nowrap;">${dateStr}</div>`}
  ${els.medications.hidden ? "" : `<div id="meds">${medicationsHTML || '<div style="color:#999">Aucun médicament</div>'}</div>`}
  ${paginationScript(paper.height, page2Top, page2Left, page2Width)}
</body>
</html>`
}

// Chrome will not repeat a tall table <thead> across pages, so instead of relying
// on the browser to reserve the header zone we compute the page breaks ourselves:
// any medication block that would cross a page boundary is pushed to the next page
// with a spacer tall enough to also clear the letterhead header on that page.
function paginationScript(paperHeightMm: number, headerMm: string, page2Left: number, page2Width: number) {
  return `<script>
  (function(){
    function paginate(){
      var mmToPx = 96/25.4, pageH = ${paperHeightMm}*mmToPx, header = ${headerMm}*mmToPx, safety = 2;
      // Reserve some space at the bottom of each page too, but less than the top
      // header zone that opens each following page.
      var footer = Math.min(header * 0.5, 20 * mmToPx);
      var p2Left = '${page2Left}%', p2W = '${page2Width}%';
      var box = document.getElementById('meds');
      if(!box) return;
      var blocks = [].slice.call(box.children), pageIndex = 0;
      for(var i=0;i<blocks.length;i++){
        var b = blocks[i];
        if(b.className === 'pgspacer') continue;
        var pageBottom = (pageIndex+1)*pageH, top = b.offsetTop, bottom = top + b.offsetHeight;
        if(bottom > pageBottom - footer - safety){
          var gap = (pageBottom - top) + header;
          var sp = document.createElement('div');
          sp.className = 'pgspacer'; sp.style.height = gap + 'px'; sp.style.width = '1px';
          // The spacer MUST be allowed to split across the page boundary, otherwise
          // break-inside:avoid pushes it wholesale onto the next page.
          sp.style.breakInside = 'auto'; sp.style.pageBreakInside = 'auto';
          box.insertBefore(sp, b); pageIndex++;
        }
        // On page 2+, move medications to their customized position/width.
        if(pageIndex >= 1){ b.style.marginLeft = p2Left; b.style.width = p2W; }
      }
    }
    if(document.readyState === 'complete') paginate();
    else window.addEventListener('load', paginate);
  })();
  </script>`
}

export default function OrdonnancePrintPreview({
  open,
  onOpenChange,
  layout,
  background,
  patientName,
  dateStr,
  medicationsHTML,
}: OrdonnancePrintPreviewProps) {
  const [els, setEls] = useState<Record<ElId, El>>(DEFAULTS)
  const [paper, setPaper] = useState<Paper>({ type: "A4", width: 210, height: 297 })
  const [selectedId, setSelectedId] = useState<ElId | null>(null)
  const [dragging, setDragging] = useState(false)
  const [bgUrl, setBgUrl] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const medsRef = useRef<HTMLDivElement>(null)
  // Height of the previewed sheet in px, rounded up to whole pages so the
  // preview shows page 2 (and beyond) when the medication list overflows.
  const [contentHpx, setContentHpx] = useState(0)

  // Seed temporary state from the saved layout each time the preview opens, so
  // edits made here never persist back to settings.
  useEffect(() => {
    if (!open) return
    const L = layout || {}
    setEls({
      patient_name: {
        x: L.patient_name?.x ?? DEFAULTS.patient_name.x,
        y: L.patient_name?.y ?? DEFAULTS.patient_name.y,
        fontSize: L.patient_name?.fontSize ?? DEFAULTS.patient_name.fontSize,
        hidden: L.patient_name?.hidden ?? false,
      },
      date: {
        x: L.date?.x ?? DEFAULTS.date.x,
        y: L.date?.y ?? DEFAULTS.date.y,
        fontSize: L.date?.fontSize ?? DEFAULTS.date.fontSize,
        hidden: L.date?.hidden ?? false,
      },
      medications: {
        x: L.medications?.x ?? DEFAULTS.medications.x,
        y: L.medications?.y ?? DEFAULTS.medications.y,
        fontSize: L.medications?.fontSize ?? DEFAULTS.medications.fontSize,
        hidden: L.medications?.hidden ?? false,
      },
    })
    setPaper(L.paper || { type: "A4", width: 210, height: 297 })
    setSelectedId(null)
  }, [open, layout])

  // Load the background (authenticated) as a blob, like the settings editor.
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

  // Measure the medication block and round the sheet up to whole pages, so the
  // preview mirrors the paginated printout (medications continue on page 2).
  useLayoutEffect(() => {
    const measure = () => {
      const el = medsRef.current
      const topPx = (els.medications.y / 100) * pageHpx
      const bottom = el ? topPx + el.offsetHeight : pageHpx
      const pages = Math.max(1, Math.ceil(bottom / pageHpx - 0.01))
      setContentHpx(pages * pageHpx)
    }
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [open, medicationsHTML, els.medications.x, els.medications.y, els.medications.fontSize, pageHpx])

  const totalPages = pageHpx > 0 ? Math.max(1, Math.round((contentHpx || pageHpx) / pageHpx)) : 1
  const sheetHpx = (contentHpx || pageHpx)

  const updateSelectedFromPointer = (clientX: number, clientY: number) => {
    if (!selectedId) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    // Positions are expressed relative to a single page, even when the preview
    // spans several pages, so dragging keeps anchoring elements to page 1.
    const onePageH = pageHpx * scale
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / onePageH) * 100))
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
    const page2X = layout?.medications_page2?.x ?? els.medications.x
    const page2Y = layout?.medications_page2?.y ?? els.medications.y
    const html = buildPrintHTML(els, paper, bgUrl || background, patientName, dateStr, medicationsHTML, page2X, page2Y)

    // Print via a hidden iframe — reliable across browsers (no popup blockers,
    // no blank-window issues from writing into window.open).
    const old = document.getElementById("ordonnance-print-frame")
    if (old) old.remove()

    const iframe = document.createElement("iframe")
    iframe.id = "ordonnance-print-frame"
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
    // Fallback if onload doesn't fire for document.write content
    setTimeout(doPrint, 800)
  }

  const renderElement = (id: ElId) => {
    const el = els[id]
    if (el.hidden) return null
    const selected = selectedId === id
    const common: React.CSSProperties = {
      position: "absolute",
      left: `${el.x}%`,
      top: `${(el.y / 100) * pageHpx}px`,
      cursor: dragging && selected ? "grabbing" : "grab",
      outline: selected ? "2px solid #2563eb" : "1px dashed rgba(37,99,235,0.35)",
      outlineOffset: "2px",
    }
    if (id === "medications") {
      return (
        <div
          key={id}
          ref={medsRef}
          onMouseDown={startDrag(id)}
          style={{
            ...common,
            fontSize: `${el.fontSize}px`,
            lineHeight: 1.5,
            width: `${100 - el.x - 5}%`,
            fontFamily: "Arial, sans-serif",
          }}
          dangerouslySetInnerHTML={{ __html: medicationsHTML || '<div style="color:#999">Aucun médicament</div>' }}
        />
      )
    }
    return (
      <div
        key={id}
        onMouseDown={startDrag(id)}
        style={{
          ...common,
          transform: "translate(0, -50%)",
          fontSize: `${el.fontSize}px`,
          whiteSpace: "nowrap",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {id === "patient_name" ? patientName : dateStr}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aperçu avant impression</DialogTitle>
          <p className="text-sm text-gray-500">
            Glissez les éléments pour les repositionner et ajustez la taille. Ces modifications sont temporaires
            (elles ne changent pas vos réglages).
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Preview page */}
          <div className="lg:col-span-8 flex justify-center bg-gray-100 rounded-xl p-4 select-none">
            <div
              ref={wrapperRef}
              onMouseDown={() => setSelectedId(null)}
              onMouseMove={(e) => {
                if (dragging) updateSelectedFromPointer(e.clientX, e.clientY)
              }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              style={{ width: DISPLAY_W, height: sheetHpx * scale, position: "relative" }}
            >
              <div
                style={{
                  width: pageWpx,
                  height: sheetHpx,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  position: "relative",
                  background: bgUrl ? `#fff url('${bgUrl}') top center / 100% ${pageHpx}px repeat-y` : "#fff",
                  boxShadow: "0 0 10px rgba(0,0,0,0.15)",
                }}
              >
                {/* Page-break guides so overflow onto page 2+ is visible */}
                {Array.from({ length: Math.max(0, totalPages - 1) }).map((_, i) => (
                  <div
                    key={`pb-${i}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: (i + 1) * pageHpx,
                      borderTop: "2px dashed #ef4444",
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 6,
                        fontSize: 22,
                        fontFamily: "Arial, sans-serif",
                        color: "#ef4444",
                        background: "rgba(255,255,255,0.85)",
                        padding: "2px 10px",
                        borderRadius: 6,
                      }}
                    >
                      Page {i + 2}
                    </span>
                  </div>
                ))}
                {renderElement("patient_name")}
                {renderElement("date")}
                {renderElement("medications")}
              </div>
            </div>
          </div>

          {/* Controls */}
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
