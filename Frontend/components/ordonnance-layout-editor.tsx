"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Save, Upload, Type, Calendar, List, ChevronUp, ChevronDown, Maximize2, Loader2, Eye, EyeOff } from "lucide-react"
import { apiClient, resolveDocumentBackgroundUrl } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface LayoutElement {
    id: string
    x: number // percentage 0-100
    y: number // percentage 0-100
    fontSize: number
    label: string
    icon: any
    hidden?: boolean // when true, the element is not printed
}

interface PaperConfig {
    type: 'A4' | 'A5' | 'Custom'
    width: number // mm
    height: number // mm
}

const PAPER_SIZES: Record<string, PaperConfig> = {
    A4: { type: 'A4', width: 210, height: 297 },
    A5: { type: 'A5', width: 148, height: 210 },
    Custom: { type: 'Custom', width: 210, height: 297 },
}

// Which elements belong to which printed page.
const PAGE1_IDS = ["patient_name", "date", "medications"]
const PAGE2_IDS = ["medications_page2"]

interface OrdonnanceLayoutEditorProps {
    initialBackground?: string
    initialLayout?: any
    onSave: (background: string, layout: any) => void
    // Optional overrides so the same editor can drive other list documents (analyses).
    uploadBackground?: (formData: FormData) => Promise<any>
    listLabel?: string
    page2Label?: string
    sampleItems?: [string, string]
}

export default function OrdonnanceLayoutEditor({
    initialBackground,
    initialLayout,
    onSave,
    uploadBackground,
    listLabel = "Liste Médicaments",
    page2Label = "Médicaments (page 2)",
    sampleItems = ["• Médicament Exemple 1", "• Médicament Exemple 2"],
}: OrdonnanceLayoutEditorProps) {
    const { toast } = useToast()
    const [background, setBackground] = useState(initialBackground || "")
    const [imageLoaded, setImageLoaded] = useState(false)
    const [paper, setPaper] = useState<PaperConfig>(initialLayout?.paper || PAPER_SIZES.A4)

    // Default elements in percentages
    const [elements, setElements] = useState<LayoutElement[]>([
        { id: "patient_name", x: initialLayout?.patient_name?.x ?? 10, y: initialLayout?.patient_name?.y ?? 15, fontSize: initialLayout?.patient_name?.fontSize ?? 18, label: "Nom Patient", icon: Type, hidden: initialLayout?.patient_name?.hidden ?? false },
        { id: "date", x: initialLayout?.date?.x ?? 70, y: initialLayout?.date?.y ?? 15, fontSize: initialLayout?.date?.fontSize ?? 16, label: "Date", icon: Calendar, hidden: initialLayout?.date?.hidden ?? false },
        { id: "medications", x: initialLayout?.medications?.x ?? 10, y: initialLayout?.medications?.y ?? 30, fontSize: initialLayout?.medications?.fontSize ?? 16, label: listLabel, icon: List, hidden: initialLayout?.medications?.hidden ?? false },
        // Where the medication list resumes on page 2 (and beyond) when it overflows.
        // Defaults near the top (page 2 usually needs less clearance than page 1)
        // and offset from the page-1 marker so it can be grabbed separately.
        { id: "medications_page2", x: initialLayout?.medications_page2?.x ?? (initialLayout?.medications?.x ?? 10), y: initialLayout?.medications_page2?.y ?? 15, fontSize: initialLayout?.medications_page2?.fontSize ?? (initialLayout?.medications?.fontSize ?? 16), label: page2Label, icon: List, hidden: initialLayout?.medications_page2?.hidden ?? false },
    ])

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [dragging, setDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const canvas2Ref = useRef<HTMLCanvasElement>(null)
    const imgRef = useRef<HTMLImageElement | null>(null)
    const elementsRef = useRef<LayoutElement[]>(elements)
    const requestRef = useRef<number>()

    // Sync elementsRef when state changes from outside
    useEffect(() => { elementsRef.current = elements }, [elements])

    // Draw one page canvas, showing only the elements that belong to it.
    const drawOne = useCallback((canvas: HTMLCanvasElement | null, ids: string[]) => {
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return

        // Fill background
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // The letterhead is the same sheet on every page.
        if (background && imageLoaded && imgRef.current) {
            ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height)
        }

        elementsRef.current.forEach((el) => {
            if (!ids.includes(el.id)) return
            const px = (el.x / 100) * canvas.width
            const py = (el.y / 100) * canvas.height
            // Hidden elements are shown faded (still movable) but won't be printed.
            ctx.globalAlpha = el.hidden ? 0.25 : 1

            ctx.font = `${selectedId === el.id ? 'bold ' : ''}${el.fontSize}px Arial`
            ctx.fillStyle = selectedId === el.id ? "#2563eb" : "black"

            const text = el.id === "patient_name" ? "M. NOM DU PATIENT" : el.id === "date" ? "05 Mai 2026" : el.id === "medications_page2" ? sampleItems.map((s) => "↳ " + s.replace(/^[•↳]\s*/, "")).join("\n") : sampleItems.join("\n")
            const padding = 10

            if (selectedId === el.id) {
                const metrics = ctx.measureText(el.label)
                ctx.strokeStyle = "#2563eb"
                ctx.lineWidth = 2
                ctx.strokeRect(px - padding / 2, py - el.fontSize - padding / 2, metrics.width + padding, el.fontSize + padding)
                ctx.fillStyle = "#2563eb"
                ctx.fillRect(px - 4, py - 4, 8, 8)
            }

            ctx.fillStyle = selectedId === el.id ? "#2563eb" : "black"
            if (el.id === "medications" || el.id === "medications_page2") {
                const lines = text.split('\n')
                lines.forEach((line, index) => {
                    ctx.fillText(line, px, py + (index * (el.fontSize + 8)))
                })
            } else {
                ctx.fillText(text, px, py)
            }
            ctx.globalAlpha = 1
        })
    }, [background, imageLoaded, selectedId])

    const drawCanvas = useCallback(() => {
        drawOne(canvasRef.current, PAGE1_IDS)
        drawOne(canvas2Ref.current, PAGE2_IDS)
    }, [drawOne])

    // Animation loop for smooth dragging
    const animate = useCallback(() => {
        drawCanvas()
        requestRef.current = requestAnimationFrame(animate)
    }, [drawCanvas])

    // Update both canvas sizes when paper format changes
    useEffect(() => {
        const ratio = paper.height / paper.width
        const displayWidth = 600
        for (const canvas of [canvasRef.current, canvas2Ref.current]) {
            if (!canvas) continue
            canvas.width = displayWidth
            canvas.height = displayWidth * ratio
        }
        drawCanvas()
    }, [paper, drawCanvas])

    useEffect(() => {
        if (dragging) {
            requestRef.current = requestAnimationFrame(animate)
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
            drawCanvas() // One final draw
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current) }
    }, [dragging, animate, drawCanvas])

    useEffect(() => {
        if (!background) {
            setImageLoaded(false)
            imgRef.current = null
            return
        }

        let isMounted = true
        setImageLoaded(false)

        const loadBg = async () => {
            try {
                const token = localStorage.getItem('auth_token') || ""
                const response = await fetch(background, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })

                if (!response.ok) throw new Error("Failed to fetch image")

                const blob = await response.blob()
                if (!isMounted) return

                const objectUrl = URL.createObjectURL(blob)
                const img = new Image()
                img.onload = () => {
                    if (!isMounted) return
                        ; (imgRef as any).current = img
                    setImageLoaded(true)
                }
                img.src = objectUrl
            } catch (error) {
                console.error("Failed to load background image:", error)
                if (isMounted) setImageLoaded(false)
            }
        }

        loadBg()

        return () => { isMounted = false }
    }, [background])

    useEffect(() => { drawCanvas() }, [selectedId, paper, drawCanvas])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return
        setUploading(true)
        const formData = new FormData()
        formData.append("background", e.target.files[0])
        try {
            const response = await (uploadBackground || apiClient.uploadOrdonnanceBackground)(formData)
            if (response.success && response.data?.url) {
                const fullUrl = resolveDocumentBackgroundUrl(response.data.url)
                setBackground(fullUrl)
                toast({ title: "Succès", description: "Image envoyée au serveur" })
            }
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message || "Échec du téléchargement", variant: "destructive" })
        } finally {
            setUploading(false)
        }
    }

    const handleMouseDown = (e: React.MouseEvent, canvas: HTMLCanvasElement | null, ids: string[]) => {
        const rect = canvas?.getBoundingClientRect()
        if (!rect || !canvas) return
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const clickX = (x / rect.width) * 100
        const clickY = (y / rect.height) * 100

        const clickedEl = elementsRef.current.find(el => {
            if (!ids.includes(el.id)) return false
            const ctx = canvas.getContext("2d")
            if (!ctx) return false
            ctx.font = `${el.fontSize}px Arial`
            const metrics = ctx.measureText(el.label)
            const widthPct = (metrics.width / canvas.width) * 100
            const heightPct = (el.fontSize / canvas.height) * 100
            return clickX >= el.x - 2 && clickX <= el.x + widthPct + 2 &&
                clickY >= el.y - heightPct - 2 && clickY <= el.y + 2
        })

        if (clickedEl) {
            setSelectedId(clickedEl.id)
            setDragging(true)
        } else {
            setSelectedId(null)
        }
    }

    const handleMouseMove = (e: React.MouseEvent, canvas: HTMLCanvasElement | null) => {
        if (!dragging || !selectedId) return
        const rect = canvas?.getBoundingClientRect()
        if (!rect) return

        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const pctX = Math.min(100, Math.max(0, (x / rect.width) * 100))
        const pctY = Math.min(100, Math.max(0, (y / rect.height) * 100))

        // Update elementsRef IMMEDIATELY for the animation loop
        elementsRef.current = elementsRef.current.map(el =>
            el.id === selectedId ? { ...el, x: pctX, y: pctY } : el
        )
    }

    const handleMouseUp = () => {
        if (dragging) {
            setDragging(false)
            // Sync back to React state only when finished dragging
            setElements(elementsRef.current)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const layout = {
                paper,
                patient_name: elements.find(e => e.id === "patient_name"),
                date: elements.find(e => e.id === "date"),
                medications: elements.find(e => e.id === "medications"),
                medications_page2: elements.find(e => e.id === "medications_page2")
            }
            await onSave(background, layout)
        } finally {
            setSaving(false)
        }
    }

    const selectedElement = elements.find(el => el.id === selectedId)

    const toggleHidden = (id: string) =>
        setElements(prev => prev.map(el => el.id === id ? { ...el, hidden: !el.hidden } : el))

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <Select value={paper.type} onValueChange={(val: any) => setPaper(PAPER_SIZES[val])}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Format papier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A4">A4 (210x297)</SelectItem>
                                <SelectItem value="A5">A5 (148x210)</SelectItem>
                                <SelectItem value="Custom">Personnalisé</SelectItem>
                            </SelectContent>
                        </Select>
                        {paper.type === 'Custom' && (
                            <div className="flex items-center gap-2">
                                <Input type="number" value={paper.width} onChange={e => setPaper({ ...paper, width: parseInt(e.target.value) || 0 })} className="w-20" placeholder="W (mm)" />
                                <span className="text-gray-400">x</span>
                                <Input type="number" value={paper.height} onChange={e => setPaper({ ...paper, height: parseInt(e.target.value) || 0 })} className="w-20" placeholder="H (mm)" />
                            </div>
                        )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => handleFileUpload(e);
                        input.click();
                    }} disabled={uploading}>
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Patientez..." : "Uploader fond"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Page 1 */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-1 rounded">Page 1</span>
                            <span className="text-xs text-gray-500">Nom, date &amp; liste des médicaments</span>
                        </div>
                        <div className="border rounded-xl bg-gray-100 overflow-hidden relative flex items-center justify-center p-4 min-h-[520px] select-none shadow-inner">
                            <canvas
                                ref={canvasRef}
                                className={`border shadow-2xl bg-white max-w-full h-auto cursor-${dragging ? 'grabbing' : 'grab'} transition-all`}
                                onMouseDown={(e) => handleMouseDown(e, canvasRef.current, PAGE1_IDS)}
                                onMouseMove={(e) => handleMouseMove(e, canvasRef.current)}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            />
                            {!background && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                                    <Maximize2 className="w-12 h-12 mb-2" />
                                    <p className="text-md font-bold">PAPIER VIERGE ({paper.type})</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Page 2 */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-1 rounded">Page 2+</span>
                            <span className="text-xs text-gray-500">Suite des médicaments (débordement)</span>
                        </div>
                        <div className="border rounded-xl bg-gray-100 overflow-hidden relative flex items-center justify-center p-4 min-h-[520px] select-none shadow-inner">
                            <canvas
                                ref={canvas2Ref}
                                className={`border shadow-2xl bg-white max-w-full h-auto cursor-${dragging ? 'grabbing' : 'grab'} transition-all`}
                                onMouseDown={(e) => handleMouseDown(e, canvas2Ref.current, PAGE2_IDS)}
                                onMouseMove={(e) => handleMouseMove(e, canvas2Ref.current)}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            />
                            {!background && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                                    <Maximize2 className="w-12 h-12 mb-2" />
                                    <p className="text-md font-bold">PAPIER VIERGE ({paper.type})</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <Card className="border-blue-100">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Type className="w-5 h-5 text-blue-600" />
                            Éléments
                        </CardTitle>
                        <CardDescription>Cliquez sur un élément ou glissez-le sur le papier</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            {elements.map(el => (
                                <div
                                    key={el.id}
                                    onClick={() => setSelectedId(el.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer
                                ${selectedId === el.id ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]' : 'hover:bg-gray-50 border-gray-100'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2.5 rounded-lg ${selectedId === el.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            <el.icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`font-bold text-sm block tracking-tight truncate ${el.hidden ? 'text-gray-400 line-through' : ''}`}>{el.label}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">POS: {Math.round(el.x)}%, {Math.round(el.y)}%</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleHidden(el.id) }}
                                        title={el.hidden ? "Afficher (imprimé)" : "Masquer (non imprimé)"}
                                        className={`flex-shrink-0 p-1.5 rounded-md hover:bg-gray-100 ${el.hidden ? 'text-gray-400' : 'text-blue-600'}`}
                                    >
                                        {el.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {selectedId && selectedElement && (
                            <div className="pt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600">Style & Taille</h4>
                                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-none">{selectedElement.fontSize} px</Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input
                                        type="number"
                                        value={selectedElement.fontSize}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 8
                                            setElements(prev => prev.map(el => el.id === selectedId ? { ...el, fontSize: val } : el))
                                        }}
                                        className="h-10 text-center font-bold"
                                    />
                                    <div className="flex gap-1 flex-1">
                                        <Button variant="secondary" className="flex-1 h-10" onClick={() => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, fontSize: el.fontSize + 1 } : el))}>
                                            <ChevronUp className="w-4 h-4" />
                                        </Button>
                                        <Button variant="secondary" className="flex-1 h-10" onClick={() => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, fontSize: Math.max(8, el.fontSize - 1) } : el))}>
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-md font-bold shadow-blue-200 shadow-xl" onClick={handleSave} disabled={saving}>
                            {saving
                                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enregistrement...</>
                                : <><Save className="w-5 h-5 mr-2" />Enregistrer la Configuration</>
                            }
                        </Button>
                    </CardContent>
                </Card>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-bold text-blue-800 flex items-center">
                        <Maximize2 className="w-4 h-4 mr-2" /> Aide au positionnement
                    </h4>
                    <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                        <li>Utilisez des % pour que le rendu soit parfait sur tout écran</li>
                        <li>Le fond est optionnel (utile pour calibrage)</li>
                        <li>Le format choisi sera appliqué à l'impression</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

function Badge({ children, className, variant }: any) {
    return <span className={`px-2 py-1 rounded text-[10px] font-bold ${className}`}>{children}</span>
}
