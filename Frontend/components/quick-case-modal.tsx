"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, Save, ExternalLink } from "lucide-react"
import { apiClient, type Appointment } from "@/lib/api"

interface QuickCaseModalProps {
  apt: Appointment | null
  onClose: () => void
  onSaved?: () => void
}

interface VitalSigns {
  weight: string
  pulse: string
  temperature: string
  blood_pressure: string
  tall: string
  notes: string
  custom_measures_values: Record<string, string>
}

export default function QuickCaseModal({ apt, onClose, onSaved }: QuickCaseModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [caseConfig, setCaseConfig] = useState({
    show_weight: true,
    show_height: true,
    show_pulse: true,
    show_temperature: true,
    show_pressure: true,
    show_ddr: true,
    custom_measures: [] as any[],
  })

  const [caseDescription, setCaseDescription] = useState("")
  const [diagnostic, setDiagnostic] = useState("")
  const [ddr, setDdr] = useState("")
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    weight: "", pulse: "", temperature: "", blood_pressure: "",
    tall: "", notes: "", custom_measures_values: {},
  })

  useEffect(() => {
    if (!apt) return

    let cancelled = false
    const loadAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const [settingsRes, apptRes] = await Promise.all([
          apiClient.getUserSettings(),
          apiClient.getEditData(Number(apt.ID_RV)),
        ])

        if (cancelled) return

        if (settingsRes.success) {
          const s = settingsRes.data.data || settingsRes.data
          let parsedMeasures: any[] = []
          if (s.custom_measures) {
            try {
              parsedMeasures = typeof s.custom_measures === "string"
                ? JSON.parse(s.custom_measures)
                : s.custom_measures
            } catch {}
          }
          setCaseConfig({
            show_weight: s.show_weight ?? true,
            show_height: s.show_height ?? true,
            show_pulse: s.show_pulse ?? true,
            show_temperature: s.show_temperature ?? true,
            show_pressure: s.show_pressure ?? true,
            show_ddr: s.show_ddr ?? true,
            custom_measures: parsedMeasures,
          })
        }

        if (apptRes.success) {
          const appt = apptRes.data.appointment || apptRes.data.data?.appointment || apptRes.data
          setCaseDescription(appt?.case_description?.case_description || "")
          setDiagnostic(appt?.diagnostic || "")
          setDdr(appt?.patient?.DDR || "")

          let parsedCustom: Record<string, string> = {}
          if (appt?.case_description?.custom_measures_values) {
            try {
              parsedCustom = typeof appt.case_description.custom_measures_values === "string"
                ? JSON.parse(appt.case_description.custom_measures_values)
                : appt.case_description.custom_measures_values
            } catch {}
          }
          setVitalSigns({
            weight: appt?.case_description?.weight?.toString() || "",
            pulse: appt?.case_description?.pulse?.toString() || "",
            temperature: appt?.case_description?.temperature?.toString() || "",
            blood_pressure: appt?.case_description?.blood_pressure || "",
            tall: appt?.case_description?.tall?.toString() || "",
            notes: appt?.case_description?.notes || "",
            custom_measures_values: parsedCustom,
          })
        }
      } catch (e) {
        if (!cancelled) setError("Erreur lors du chargement des données")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [apt?.ID_RV])

  const handleSave = useCallback(async () => {
    if (!apt) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiClient.updateAppointmentDetails(Number(apt.ID_RV), {
        case_description: caseDescription,
        weight: vitalSigns.weight ? Number(vitalSigns.weight) : undefined,
        pulse: vitalSigns.pulse ? Number(vitalSigns.pulse) : undefined,
        temperature: vitalSigns.temperature ? Number(vitalSigns.temperature) : undefined,
        blood_pressure: vitalSigns.blood_pressure || undefined,
        tall: vitalSigns.tall ? Number(vitalSigns.tall) : undefined,
        DDR: ddr || undefined,
        notes: vitalSigns.notes || undefined,
        custom_measures_values: vitalSigns.custom_measures_values,
        diagnostic: diagnostic,
        medicaments: [],
        analyses: [],
      })
      if (!res.success) throw new Error(res.message || "Erreur")
      onSaved?.()
      onClose()
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }, [apt, caseDescription, diagnostic, ddr, vitalSigns, onSaved, onClose])

  const patientName = apt
    ? `${(apt as any).patient?.first_name || ""} ${(apt as any).patient?.last_name || ""}`.trim()
    : ""

  const ddrPregnancyInfo = (() => {
    if (!ddr) return null
    const ddrDate = new Date(ddr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    ddrDate.setHours(0, 0, 0, 0)
    if (ddrDate > today) return null
    const diffDays = Math.floor((today.getTime() - ddrDate.getTime()) / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(diffDays / 7)
    const days = diffDays % 7
    const dpa = new Date(ddrDate)
    dpa.setFullYear(dpa.getFullYear() + 1)
    dpa.setMonth(dpa.getMonth() - 3)
    dpa.setDate(dpa.getDate() + 7)
    const [label, classes] =
      weeks <= 12 ? ["1er Trimestre", "bg-green-50 border-green-300 text-green-700"]
      : weeks <= 27 ? ["2ème Trimestre", "bg-yellow-50 border-yellow-300 text-yellow-700"]
      : weeks <= 40 ? ["3ème Trimestre", "bg-orange-50 border-orange-300 text-orange-700"]
      : ["Post-terme", "bg-red-50 border-red-300 text-red-700"]
    return { weeks, days, dpa, label, classes }
  })()

  return (
    <Dialog open={!!apt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-blue-700 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Description du Cas
            {patientName && (
              <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700 font-normal">
                {patientName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {/* Case description */}
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                Description du cas <span className="text-red-400 text-xs">obligatoire</span>
              </label>
              <Textarea
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                placeholder="Décrivez les plaintes et symptômes du patient..."
                className="min-h-[110px] resize-y text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300"
                rows={4}
              />
            </div>

            {/* Vital signs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {caseConfig.show_height && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Taille (cm)</label>
                  <Input type="number" min="0" step="0.1"
                    value={vitalSigns.tall}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, tall: e.target.value })}
                    className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                  />
                </div>
              )}
              {caseConfig.show_weight && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Poids (kg)</label>
                  <Input type="number" min="0" step="0.1"
                    value={vitalSigns.weight}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, weight: e.target.value })}
                    className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                  />
                </div>
              )}
              {caseConfig.show_temperature && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Température (°C)</label>
                  <Input type="number" min="0" step="0.1"
                    value={vitalSigns.temperature}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                    className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                  />
                </div>
              )}
              {caseConfig.show_pulse && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Pouls (bpm)</label>
                  <Input type="number" min="0" step="1"
                    value={vitalSigns.pulse}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, pulse: e.target.value })}
                    className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                  />
                </div>
              )}
              {caseConfig.show_pressure && (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Tension Artérielle</label>
                  <Input type="text"
                    value={vitalSigns.blood_pressure}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, blood_pressure: e.target.value })}
                    placeholder="ex: 120/80"
                    className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                  />
                </div>
              )}

              {caseConfig.custom_measures.map((measure: any, idx: number) => {
                const key = measure.name
                const val = vitalSigns.custom_measures_values[key] || vitalSigns.custom_measures_values[measure.short] || ""
                return (
                  <div key={idx}>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      {measure.name}{measure.short ? ` (${measure.short})` : ""}
                    </label>
                    {measure.choices ? (
                      <select
                        value={val}
                        onChange={(e) => setVitalSigns({
                          ...vitalSigns,
                          custom_measures_values: { ...vitalSigns.custom_measures_values, [key]: e.target.value },
                        })}
                        className="h-8 w-full border rounded-md px-2 text-sm border-blue-200 bg-blue-50/50 text-blue-700"
                      >
                        <option value="">Sélectionner...</option>
                        {measure.choices.split(",").map((c: string, ci: number) => (
                          <option key={ci} value={c.trim()}>{c.trim()}</option>
                        ))}
                      </select>
                    ) : (
                      <Input type="text" value={val}
                        onChange={(e) => setVitalSigns({
                          ...vitalSigns,
                          custom_measures_values: { ...vitalSigns.custom_measures_values, [key]: e.target.value },
                        })}
                        placeholder={measure.min_value && measure.max_value ? `${measure.min_value} – ${measure.max_value}` : ""}
                        className="h-8 border-blue-200 bg-blue-50/50 text-blue-700"
                      />
                    )}
                  </div>
                )
              })}

              {caseConfig.show_ddr && (
                <div className="col-span-2 sm:col-span-3">
                  <label className="block text-xs font-medium text-blue-700 mb-1">DDR (Date des Dernières Règles)</label>
                  <Input type="date" value={ddr}
                    onChange={(e) => setDdr(e.target.value)}
                    className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                  />
                  {ddrPregnancyInfo && (
                    <div className={`mt-2 p-2 rounded-lg border-2 text-xs ${ddrPregnancyInfo.classes}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">
                          🤰 {ddrPregnancyInfo.weeks} SA + {ddrPregnancyInfo.days}j — {ddrPregnancyInfo.label}
                        </span>
                        <span>
                          📅 DPA: {ddrPregnancyInfo.dpa.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="col-span-2 sm:col-span-3">
                <label className="block text-xs font-medium text-blue-700 mb-1">Notes</label>
                <Input value={vitalSigns.notes}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, notes: e.target.value })}
                  placeholder="Observations supplémentaires"
                  className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300"
                />
              </div>
            </div>

            {/* Diagnostic */}
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">Diagnostic</label>
              <Textarea
                value={diagnostic}
                onChange={(e) => setDiagnostic(e.target.value)}
                placeholder="Diagnostic du patient..."
                className="min-h-[80px] resize-y text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={() => { onClose(); if (apt) router.push(`/appointments/${apt.ID_RV}`) }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ouvrir le dossier complet
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
