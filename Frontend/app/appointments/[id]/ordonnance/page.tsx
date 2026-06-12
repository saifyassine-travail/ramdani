"use client"

import type React from "react"
import { useToast } from "@/hooks/use-toast" // Import useToast from react-hot-toast

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Textarea } from "../../../../components/ui/textarea"
import { Badge } from "../../../../components/ui/badge"
import {
  Calendar,
  Clock,
  User,
  FileText,
  Pill as Pills,
  Flag as Flask,
  Save,
  Plus,
  Trash2,
  History,
  Printer as Print,
  Edit3,
  Loader2,
  Check,
} from "lucide-react"
import { cn } from "../../../../lib/utils"
import { apiClient, type Appointment, type Medicament, type Analysis } from "../../../../lib/api"

interface MedicationForm {
  ID_Medicament: number | string
  name?: string
  type?: string
  type_category?: string
  pivot: {
    dosage: string
    frequence: string
    duree: string
  }
}

interface AnalysisForm {
  ID_Analyse: number | string
  name: string
}

interface LastAppointmentData {
  date: string
  medicaments: Array<{
    id: number
    name: string
    dosage?: string
    frequence?: string
    duree?: string
  }>
  analyses: Array<{
    id: number
    name: string
  }>
  case_description?: string
}

// ── Posology helpers ────────────────────────────────────────────────────────
const TIME_ORDER = ['Matin', 'Midi', 'Soir'] as const
const MEAL_TIMINGS = ['avant repas', 'pendant repas', 'après repas'] as const

interface MedDose {
  time: string
  units: string
}

// Resolve the short pharmaceutical form label (cp, sirop, inj, ...)
function getMedTypeLabel(med: { type?: string; type_category?: string; name?: string }): string {
  const cat = (med.type_category || '').toLowerCase()
  const raw = (med.type || '').toLowerCase()
  const src = cat || raw
  if (!src) {
    const afterComma = (med.name || '').split(',').pop()?.trim().toLowerCase() || ''
    if (afterComma.includes('comprim')) return 'cp'
    if (afterComma.includes('sirop')) return 'sirop'
    if (afterComma.includes('gélule') || afterComma.includes('gelule') || afterComma.includes('capsule')) return 'gél'
    if (afterComma.includes('inject')) return 'inj'
    return afterComma.split(' ')[0] || 'cp'
  }
  if (src.includes('comprim')) return 'cp'
  if (src.includes('sirop')) return 'sirop'
  if (src.includes('gelule') || src.includes('gélule') || src.includes('capsule')) return 'gél'
  if (src.includes('suspension injectable')) return 'susp inj'
  if (src.includes('injectable') || src.includes('injection')) return 'inj'
  if (src.includes('perfusion')) return 'perf'
  if (src.includes('solution')) return 'sol'
  if (src.includes('suspension')) return 'susp'
  if (src.includes('sachet')) return 'sachet'
  if (src.includes('creme') || src.includes('crème') || src.includes('pommade')) return 'crème'
  if (src.includes('spray') || src.includes('aerosol') || src.includes('aérosol')) return 'spray'
  if (src.includes('suppositoire')) return 'supp'
  if (src.includes('goutte') || src.includes('collyre')) return 'gouttes'
  if (src.includes('patch')) return 'patch'
  if (src.includes('poudre')) return 'pdr'
  return cat.split(' ')[0] || raw.split(' ')[0] || 'cp'
}

function isInjType(med: { type?: string; type_category?: string }): boolean {
  const src = `${med.type_category || ''} ${med.type || ''}`.toLowerCase()
  return src.includes('injectable') || src.includes('injection')
}

// Parse the `frequence` field into per-time units + a single meal timing.
// New format: "Matin:2,Midi:1,Soir:2;après repas"
// Stays tolerant of the legacy "Matin:après repas" / "Matin:2:après repas" formats.
function parseMedFrequence(frequence: string): { doses: MedDose[]; mealTiming: string } {
  if (!frequence) return { doses: [], mealTiming: '' }
  let mealTiming = ''
  let dosePart = frequence
  const semiIdx = frequence.indexOf(';')
  if (semiIdx >= 0) {
    dosePart = frequence.slice(0, semiIdx)
    mealTiming = frequence.slice(semiIdx + 1).trim()
  }
  const doses = dosePart
    .split(',')
    .map((part) => {
      const seg = part.split(':')
      const time = (seg[0] || '').trim()
      let units = (seg[1] || '').trim()
      // Legacy: a non-numeric second segment was actually the meal timing
      if (units && isNaN(Number(units))) {
        if (!mealTiming) mealTiming = units
        units = ''
      }
      if (seg.length >= 3 && !mealTiming) mealTiming = seg.slice(2).join(':').trim()
      return { time, units }
    })
    .filter((d) => (TIME_ORDER as readonly string[]).includes(d.time))
  return { doses, mealTiming }
}

function buildMedFrequence(doses: MedDose[], mealTiming: string): string {
  const sorted = [...doses].sort(
    (a, b) => TIME_ORDER.indexOf(a.time as any) - TIME_ORDER.indexOf(b.time as any),
  )
  const dosePart = sorted.map((d) => `${d.time}:${d.units}`).join(',')
  return mealTiming ? `${dosePart};${mealTiming}` : dosePart
}

export default function AppointmentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast() // Declare useToast here
  const appointmentId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [lastAppointment, setLastAppointment] = useState<LastAppointmentData | null>(null)
  const [availableMedicaments, setAvailableMedicaments] = useState<Medicament[]>([])
  const [availableAnalyses, setAvailableAnalyses] = useState<Analysis[]>([])

  const [caseDescription, setCaseDescription] = useState("")
  const [diagnostic, setDiagnostic] = useState("")
  const [vitalSigns, setVitalSigns] = useState({
    weight: "",
    pulse: "",
    temperature: "",
    blood_pressure: "",
    tall: "",
    spo2: "",
    notes: "",
  })
  const [medications, setMedications] = useState<MedicationForm[]>([])
  const [analyses, setAnalyses] = useState<AnalysisForm[]>([])
  const [ordonnanceConfig, setOrdonnanceConfig] = useState<any>(null)

  // Fetch settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiClient.getUserSettings()
        if (response.success) {
          const settingsData = response.data.data ? response.data.data : response.data;
          setOrdonnanceConfig({
            background: settingsData.ordonnance_background || null,
            layout: typeof settingsData.ordonnance_layout === 'string'
              ? JSON.parse(settingsData.ordonnance_layout)
              : settingsData.ordonnance_layout || null
          })
        }
      } catch (error) {
        console.error("Error loading settings:", error)
      }
    }
    loadSettings()
  }, [])

  const handlePrintOrdonnance = () => {
    try {
      const layout = ordonnanceConfig?.layout
      const background = ordonnanceConfig?.background

      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast({
          title: "Erreur",
          description: "Impossible d'ouvrir la fenêtre d'impression",
        })
        return
      }

      const patientName = appointment?.patient?.name || "Patient"
      const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

      // Helper to generate medication HTML block for ordonnance (2 lines: name + posology)
      const getMedicationHTML = (med: MedicationForm) => {
        const { doses, mealTiming } = parseMedFrequence(med.pivot?.frequence || '')
        const duration = med.pivot?.duree || ''
        const fullName = med.name || 'Médicament'
        const typeLabel = getMedTypeLabel(med)
        const isInj = isInjType(med)
        const baseName = fullName.includes(',') ? fullName.split(',')[0].trim() : fullName
        const parts = doses.map(d => {
          const qty = d.units || '1'
          const label = isInj ? (Number(qty) > 1 ? 'unités' : 'unité') : typeLabel
          return `${qty} ${label} ${d.time.toLowerCase()}`
        })
        if (mealTiming) parts.push(mealTiming)
        if (duration) parts.push(`pendant ${duration}`)
        const posology = parts.join(', ')
        return `<div style="margin-bottom:14px;"><div style="font-weight:bold;margin-bottom:2px;">${baseName} :</div><div style="padding-left:20px;line-height:1.8;">${posology}</div></div>`
      }

      let ordonnanceHTML = ""

      if (layout) {
        // CUSTOM LAYOUT LOGIC with Percentage coordinates and Paper Size
        const elements = layout as any
        const paper = layout.paper || { width: 210, height: 297, type: 'A4' }

        ordonnanceHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ordonnance - ${patientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: ${paper.width}mm ${paper.height}mm; 
      margin: 0; 
    }
    body { 
      font-family: Arial, sans-serif; 
      width: ${paper.width}mm; 
      height: ${paper.height}mm;
      overflow: hidden;
    }
    .page { 
      position: relative; 
      width: 100%; 
      height: 100%;
      background-image: ${background ? `url('${background}')` : 'none'};
      background-size: cover;
      background-repeat: no-repeat;
      background-position: center;
    }
    .element { position: absolute; transform: translate(0, -50%); }
    .meds-container { display: flex; flex-direction: column; transform: none; }
    
    @media screen {
      body { background: #eee; display: flex; justify-content: center; padding: 20px; height: auto; overflow: auto; }
      .page { background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: ${paper.width}mm; height: ${paper.height}mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="element" style="left: ${elements.patient_name?.x}%; top: ${elements.patient_name?.y}%; font-size: ${elements.patient_name?.fontSize}px; white-space: nowrap;">
      ${patientName}
    </div>
    <div class="element" style="left: ${elements.date?.x}%; top: ${elements.date?.y}%; font-size: ${elements.date?.fontSize}px; white-space: nowrap;">
      ${dateStr}
    </div>
    <div class="element meds-container" style="left: ${elements.medications?.x}%; top: ${elements.medications?.y}%; font-size: ${elements.medications?.fontSize}%; line-height: 1.5; width: ${100 - (elements.medications?.x || 0) - 5}%">
       ${medications.map(m => getMedicationHTML(m)).join('')}
    </div>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
        // window.close();
      }, 500);
    };
  </script>
</body>
</html>`
      } else {
        // FALLBACK TO OLD LOGIC
        ordonnanceHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Ordonnance</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 40px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .print-container { max-width: 800px; width: 100%; text-align: center; }
      .medication-list { display: flex; flex-direction: column; gap: 15px; align-items: center; justify-content: center; }
      .medication-item { font-size: 18px; text-align: right; padding: 10px 20px; margin-left: 100px; }
      @media print {
        body { padding: 20px; }
        .print-container { max-width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="print-container">
      <div class="medication-list">
        ${medications.length > 0 ? medications.map(m => getMedicationHTML(m)).join("") : '<div style="color: #999;">Aucun médicament prescrit</div>'}
      </div>
    </div>
  </body>
</html>`
      }

      printWindow.document.write(ordonnanceHTML)
      printWindow.document.close()
    } catch (error) {
      console.error("[v0] Error printing ordonnance:", error)
      toast({ title: "Erreur", description: "Erreur lors de l'impression de l'ordonnance" })
    }
  }

  const handlePrintAnalyses = () => {
    try {
      // Create a new window for printing
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast({
          title: "Erreur",
          description: "Impossible d'ouvrir la fenêtre d'impression",
        })
        return
      }

      const analysesHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Demandes d'Analyses</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 40px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .print-container { max-width: 800px; width: 100%; text-align: center; }
              .analysis-list { display: flex; flex-direction: column; gap: 15px; align-items: center; justify-content: center; }
              .analysis-item { font-size: 18px; text-align: right; padding: 10px 20px; margin-left: 100px; }
              @media print {
                body { padding: 20px; }
                .print-container { max-width: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="print-container">
              <div class="analysis-list">
                ${analyses.length > 0
          ? analyses
            .map(
              (analysis) => `
                  <div class="analysis-item">• ${analysis.name || "Analyse"}</div>
                `,
            )
            .join("")
          : '<div class="analysis-item" style="color: #999;">Aucune analyse demandée</div>'
        }
              </div>
            </div>
          </body>
        </html>
      `

      printWindow.document.write(analysesHTML)
      printWindow.document.close()

      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (error) {
      console.error("[v0] Error printing analyses:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors de l'impression des analyses",
      })
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log("[v0] Fetching appointment data for ID:", appointmentId)

        // Fetch appointment edit data
        const response = await apiClient.getEditData(Number(appointmentId))

        console.log("[v0] getEditData response:", response)
        console.log("[v0] Full response.data structure:", JSON.stringify(response.data, null, 2))
        console.log("[v0] response.data keys:", Object.keys(response.data || {}))

        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to load appointment data")
        }

        let appt = response.data.appointment || response.data.data?.appointment || response.data
        const available_medicaments =
          response.data.available_medicaments ||
          response.data.data?.available_medicaments ||
          response.data.availableMedicaments ||
          []
        const available_analyses =
          response.data.available_analyses ||
          response.data.data?.available_analyses ||
          response.data.availableAnalyses ||
          []

        console.log("[v0] Extracted appointment:", appt)
        console.log("[v0] Extracted medicaments:", available_medicaments)
        console.log("[v0] Extracted analyses:", available_analyses)

        if (!appt || !appt.ID_RV) {
          console.log(
            "[v0] Appointment not found in expected structure, checking if response.data is the appointment itself",
          )
          if (response.data.ID_RV) {
            appt = response.data
          }
        }

        if (!appt || !appt.ID_RV) {
          throw new Error("Appointment data not found in response")
        }

        setAppointment(appt)
        setAvailableMedicaments(available_medicaments || [])
        setAvailableAnalyses(available_analyses || [])

        // Set form values from appointment data with safe null checks
        setCaseDescription(appt?.caseDescription?.case_description || "")
        setDiagnostic(appt?.diagnostic || "")
        setVitalSigns({
          weight: appt?.caseDescription?.weight?.toString() || "",
          pulse: appt?.caseDescription?.pulse?.toString() || "",
          temperature: appt?.caseDescription?.temperature?.toString() || "",
          blood_pressure: appt?.caseDescription?.blood_pressure || "",
          tall: appt?.caseDescription?.tall?.toString() || "",
          spo2: appt?.caseDescription?.spo2?.toString() || "",
          notes: appt?.caseDescription?.notes || "",
        })

        // Set medications with safe null checks
        if (appt?.medicaments && Array.isArray(appt.medicaments) && appt.medicaments.length > 0) {
          setMedications(
            appt.medicaments.map((med) => ({
              ID_Medicament: med?.ID_Medicament || "",
              name: med?.name || "",
              pivot: {
                dosage: med?.pivot?.dosage || "",
                frequence: med?.pivot?.frequence || "",
                duree: med?.pivot?.duree || "",
              },
            })),
          )
        }

        // Set analyses with safe null checks
        if (appt?.analyses && Array.isArray(appt.analyses) && appt.analyses.length > 0) {
          setAnalyses(
            appt.analyses.map((analysis) => ({
              ID_Analyse: analysis?.ID_Analyse || "",
              name: analysis?.type_analyse || "",
            })),
          )
        }

        // Fetch last appointment info
        try {
          console.log("[v0] Fetching last appointment info for ID:", appointmentId)
          const lastResponse = await apiClient.getLastAppointmentInfo(Number(appointmentId))
          console.log("[v0] Last appointment response:", lastResponse)
          console.log("[v0] Last appointment response.data:", lastResponse.data)
          console.log(
            "[v0] Last appointment response.data keys:",
            lastResponse.data ? Object.keys(lastResponse.data) : "null",
          )

          if (lastResponse.success && lastResponse.data) {
            const rawData = lastResponse.data as any

            // Try multiple possible field names for date
            const date = rawData.date || rawData.appointment_date || rawData.appointment?.appointment_date || ""
            const caseDesc = rawData.case_description || rawData.caseDescription || rawData.case?.case_description || ""

            // Handle medicaments - could be array or nested differently
            let medicaments = []
            if (Array.isArray(rawData.medicaments)) {
              medicaments = rawData.medicaments.map((med: any) => ({
                id: med.id || med.ID_Medicament,
                name: med.name,
                dosage: med.pivot?.dosage || med.dosage || "",
                frequence: med.pivot?.frequence || med.frequence || "",
                duree: med.pivot?.duree || med.duree || "",
              }))
            } else if (rawData.data?.medicaments && Array.isArray(rawData.data.medicaments)) {
              medicaments = rawData.data.medicaments.map((med: any) => ({
                id: med.id || med.ID_Medicament,
                name: med.name,
                dosage: med.pivot?.dosage || med.dosage || "",
                frequence: med.pivot?.frequence || med.frequence || "",
                duree: med.pivot?.duree || med.duree || "",
              }))
            }

            // Handle analyses - could be array or nested differently
            let analyses = []
            if (Array.isArray(rawData.analyses)) {
              analyses = rawData.analyses
            } else if (rawData.data?.analyses && Array.isArray(rawData.data.analyses)) {
              analyses = rawData.data.analyses
            }

            const lastAppointmentData = {
              date: date,
              case_description: caseDesc,
              medicaments: medicaments,
              analyses: analyses,
            }

            console.log("[v0] Processed last appointment data:", lastAppointmentData)
            setLastAppointment(lastAppointmentData)
          }
        } catch (err) {
          console.error("[v0] Error fetching last appointment:", err)
        }
      } catch (err) {
        console.error("[v0] Error fetching appointment data:", err)
        setError(err instanceof Error ? err.message : "Failed to load appointment data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [appointmentId])

  const addMedication = () => {
    const newMedication: MedicationForm = {
      ID_Medicament: "",
      name: "",
      pivot: {
        dosage: "",
        frequence: "",
        duree: "",
      },
    }
    setMedications([...medications, newMedication])
  }

  const copyMedicamentFromLast = (medicament: LastAppointmentData["medicaments"][0]) => {
    const newMedication: MedicationForm = {
      ID_Medicament: medicament.id,
      name: medicament.name,
      pivot: {
        dosage: medicament.dosage || "",
        frequence: medicament.frequence || "",
        duree: medicament.duree || "",
      },
    }
    setMedications([...medications, newMedication])
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: string, value: string) => {
    const updated = [...medications]
    if (field === "ID_Medicament") {
      updated[index].ID_Medicament = value
      const med = availableMedicaments.find((m) => m.ID_Medicament.toString() === value)
      if (med) {
        updated[index].name = med.name
        updated[index].type = med.type || undefined
        updated[index].type_category = med.type_category || undefined
      }
    } else if (field === "name") {
      updated[index].name = value
    } else {
      updated[index].pivot = { ...updated[index].pivot, [field]: value }
    }
    setMedications(updated)
  }

  const addAnalysis = () => {
    const newAnalysis: AnalysisForm = {
      ID_Analyse: "",
      name: "",
    }
    setAnalyses([...analyses, newAnalysis])
  }

  const copyAnalysisFromLast = (analysis: LastAppointmentData["analyses"][0]) => {
    const newAnalysis: AnalysisForm = {
      ID_Analyse: analysis.id,
      name: analysis.name,
    }
    setAnalyses([...analyses, newAnalysis])
  }

  const removeAnalysis = (index: number) => {
    setAnalyses(analyses.filter((_, i) => i !== index))
  }

  const updateAnalysis = (index: number, field: string, value: string) => {
    const updated = [...analyses]
    if (field === "ID_Analyse") {
      updated[index].ID_Analyse = value
      // Find the analysis name from available analyses
      const analysis = availableAnalyses.find((a) => a.ID_Analyse.toString() === value)
      if (analysis) {
        updated[index].name = analysis.type_analyse
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setAnalyses(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError(null)

      // Prepare medicaments data
      const medicamentsData = medications
        .filter((med) => med.ID_Medicament && med.ID_Medicament !== "")
        .map((med) => ({
          ID_Medicament: Number(med.ID_Medicament),
          dosage: med.pivot.dosage,
          frequence: med.pivot.frequence,
          duree: med.pivot.duree,
        }))

      // Prepare analyses data
      const analysesData = analyses
        .filter((analysis) => analysis.ID_Analyse && analysis.ID_Analyse !== "")
        .map((analysis) => ({
          ID_Analyse: Number(analysis.ID_Analyse),
        }))

      const requestData = {
        case_description: caseDescription || "",
        weight: vitalSigns.weight ? Number(vitalSigns.weight) : undefined,
        pulse: vitalSigns.pulse ? Number(vitalSigns.pulse) : undefined,
        temperature: vitalSigns.temperature ? Number(vitalSigns.temperature) : undefined,
        blood_pressure: vitalSigns.blood_pressure || undefined,
        tall: vitalSigns.tall ? Number(vitalSigns.tall) : undefined,
        spo2: vitalSigns.spo2 ? Number(vitalSigns.spo2) : undefined,
        notes: vitalSigns.notes || undefined,
        diagnostic: diagnostic || "",
        medicaments: medicamentsData,
        analyses: analysesData,
      }

      console.log("[v0] Submitting appointment details:", JSON.stringify(requestData, null, 2))

      // Call API to update appointment details
      const response = await apiClient.updateAppointmentDetails(Number(appointmentId), requestData)

      console.log("[v0] Update response:", response)

      if (!response.success) {
        console.error("[v0] Error response:", JSON.stringify(response, null, 2))
        throw new Error(response.message || "Failed to save appointment details")
      }

      toast({
        title: "Succès",
        description: "Détails du rendez-vous sauvegardés avec succès!",
      })
      router.push("/medecin")
    } catch (err) {
      console.error("[v0] Error saving appointment:", err)
      setError(err instanceof Error ? err.message : "Failed to save appointment details")
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des détails du rendez-vous...</p>
        </div>
      </div>
    )
  }

  if (error || !appointment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Rendez-vous introuvable"}</p>
          <Button onClick={() => router.push("/medecin")}>Retour au tableau de bord</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Détails du Rendez-vous</h1>
          <div className="flex items-center mt-2 text-gray-600">
            <User className="w-4 h-4 mr-2" />
            <span className="font-medium">{appointment.patient.name}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Calendar className="w-3 h-3 mr-1" />
            {formatDate(appointment.appointment_date)}
          </Badge>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Clock className="w-3 h-3 mr-1" />
            {formatTime(appointment.updated_at || appointment.appointment_date)}
          </Badge>
        </div>
      </div>

      {lastAppointment && (
        <Card className="mb-8 border-l-4 border-l-blue-500">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50">
            <CardTitle className="text-lg text-blue-700 flex items-center">
              <History className="w-5 h-5 mr-3" />
              Rendez-vous précédent - {lastAppointment.date}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {!lastAppointment.case_description &&
              (!lastAppointment.medicaments || lastAppointment.medicaments.length === 0) &&
              (!lastAppointment.analyses || lastAppointment.analyses.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Aucune donnée disponible pour le rendez-vous précédent</p>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-4">
                {lastAppointment.case_description && (
                  <p>
                    <strong>Notes du cas:</strong> {lastAppointment.case_description}
                  </p>
                )}
                {lastAppointment.medicaments && lastAppointment.medicaments.length > 0 && (
                  <div>
                    <strong className="block mb-2">Médicaments:</strong>
                    <div className="space-y-2">
                      {lastAppointment.medicaments.map((med) => (
                        <div key={med.id} className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                          <span>
                            {med.name} - {med.dosage} - {med.frequence} - {med.duree}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyMedicamentFromLast(med)}
                            className="ml-2 bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lastAppointment.analyses && lastAppointment.analyses.length > 0 && (
                  <div>
                    <strong className="block mb-2">Analyses:</strong>
                    <div className="space-y-2">
                      {lastAppointment.analyses.map((analysis) => (
                        <div
                          key={analysis.id}
                          className="flex items-center justify-between bg-gray-50 p-3 rounded border"
                        >
                          <span>{analysis.name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyAnalysisFromLast(analysis)}
                            className="ml-2 bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Case Description Section */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-blue-700 flex items-center">
                <FileText className="w-5 h-5 mr-3" />
                Description du Cas
              </CardTitle>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                OBLIGATOIRE
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <Textarea
              value={caseDescription}
              onChange={(e) => setCaseDescription(e.target.value)}
              placeholder="Décrivez les plaintes et symptômes du patient..."
              className="min-h-[120px] resize-y"
              rows={4}
            />

            {/* Vital Signs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poids (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={vitalSigns.weight}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, weight: e.target.value })}
                  placeholder="70.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pouls (bpm)</label>
                <Input
                  type="number"
                  value={vitalSigns.pulse}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, pulse: e.target.value })}
                  placeholder="72"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Température (°C)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={vitalSigns.temperature}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                  placeholder="36.6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tension artérielle</label>
                <Input
                  value={vitalSigns.blood_pressure}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, blood_pressure: e.target.value })}
                  placeholder="120/80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taille (cm)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={vitalSigns.tall}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, tall: e.target.value })}
                  placeholder="175"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
                <Input
                  type="number"
                  value={vitalSigns.spo2}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, spo2: e.target.value })}
                  placeholder="98"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Input
                  value={vitalSigns.notes}
                  onChange={(e) => setVitalSigns({ ...vitalSigns, notes: e.target.value })}
                  placeholder="Observations supplémentaires"
                />
              </div>
            </div>

            {/* Diagnostic */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic</label>
              <Textarea
                value={diagnostic}
                onChange={(e) => setDiagnostic(e.target.value)}
                placeholder="Diagnostic du patient..."
                className="min-h-[100px] resize-y"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Treatment Plan Section */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-blue-700 flex items-center">
                <Pills className="w-5 h-5 mr-3" />
                Plan de Traitement
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => router.push(`/appointments/${appointmentId}/ordonnance`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Créer Ordonnance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-green-500 text-white hover:bg-green-600"
                  onClick={handlePrintOrdonnance}
                >
                  <Print className="w-4 h-4 mr-2" />
                  Imprimer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Médicaments prescrits</label>
              <div className="space-y-4">
                {medications.map((med, index) => {
                  const { doses, mealTiming } = parseMedFrequence(med.pivot.frequence || '')
                  const unitLabel = isInjType(med) ? 'unité' : getMedTypeLabel(med)
                  const toggleTime = (time: string) => {
                    const exists = doses.some(d => d.time === time)
                    const next = exists ? doses.filter(d => d.time !== time) : [...doses, { time, units: '' }]
                    updateMedication(index, 'frequence', buildMedFrequence(next, mealTiming))
                  }
                  const setUnits = (time: string, units: string) => {
                    updateMedication(index, 'frequence', buildMedFrequence(doses.map(d => d.time === time ? { ...d, units } : d), mealTiming))
                  }
                  const setMeal = (m: string) => {
                    updateMedication(index, 'frequence', buildMedFrequence(doses, mealTiming === m ? '' : m))
                  }
                  return (
                    <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
                      {/* Medication name + remove */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <select
                          value={med.ID_Medicament}
                          onChange={(e) => updateMedication(index, "ID_Medicament", e.target.value)}
                          className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sélectionner un médicament</option>
                          {availableMedicaments.map((medicament) => (
                            <option key={medicament.ID_Medicament} value={medicament.ID_Medicament}>
                              {medicament.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMedication(index)}
                          className="flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Posology: per-time units */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Posologie</p>
                        <div className="grid grid-cols-3 gap-3">
                          {TIME_ORDER.map((time) => {
                            const dose = doses.find(d => d.time === time)
                            const active = !!dose
                            return (
                              <div
                                key={time}
                                className={cn(
                                  "rounded-xl border p-3 transition-all",
                                  active ? "border-blue-400 bg-blue-50/60 shadow-sm" : "border-gray-200 bg-gray-50",
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleTime(time)}
                                  className="flex w-full items-center gap-2"
                                >
                                  <span
                                    className={cn(
                                      "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                                      active ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white",
                                    )}
                                  >
                                    {active && <Check className="h-3.5 w-3.5" />}
                                  </span>
                                  <span className={cn("text-sm font-semibold", active ? "text-blue-700" : "text-gray-600")}>
                                    {time}
                                  </span>
                                </button>
                                {active && (
                                  <div className="mt-3 flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={dose!.units}
                                      onChange={(e) => setUnits(time, e.target.value)}
                                      placeholder="1"
                                      className="h-9 text-center text-sm"
                                    />
                                    <span className="whitespace-nowrap text-xs font-medium text-gray-500">{unitLabel}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Meal timing (applies to all times) */}
                      {doses.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Par rapport au repas</p>
                          <div className="grid grid-cols-3 gap-3">
                            {MEAL_TIMINGS.map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setMeal(m)}
                                className={cn(
                                  "rounded-xl border py-2.5 text-sm font-medium capitalize transition-all",
                                  mealTiming === m
                                    ? "border-blue-400 bg-blue-50/60 text-blue-700 shadow-sm"
                                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100",
                                )}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Duration */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Durée du traitement</p>
                        <Input
                          value={med.pivot.duree}
                          onChange={(e) => updateMedication(index, "duree", e.target.value)}
                          placeholder="ex: 5 jours, 2 semaines..."
                          className="h-10"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addMedication}
                className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un Médicament
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Section */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-blue-700 flex items-center">
                <Flask className="w-5 h-5 mr-3" />
                Demandes d'Analyses
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-green-500 text-white hover:bg-green-600"
                onClick={handlePrintAnalyses}
              >
                <Print className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Analyses demandées</label>
              <div className="space-y-3">
                {analyses.map((analysis, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border">
                    <div className="flex-grow">
                      <select
                        value={analysis.ID_Analyse}
                        onChange={(e) => updateAnalysis(index, "ID_Analyse", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner une analyse</option>
                        {availableAnalyses.map((availableAnalysis) => (
                          <option key={availableAnalysis.ID_Analyse} value={availableAnalysis.ID_Analyse}>
                            {availableAnalysis.type_analyse}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAnalysis(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addAnalysis}
                className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une Analyse
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.push("/medecin")}>
            Annuler
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
