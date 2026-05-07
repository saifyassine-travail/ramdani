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
} from "lucide-react"
import { apiClient, type Appointment, type Medicament, type Analysis } from "../../../../lib/api"

interface MedicationForm {
  ID_Medicament: number | string
  name?: string
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

      // Helper to generate medication text
      const getMedicationText = (med: MedicationForm) => {
        const times = med.pivot?.frequence ? med.pivot.frequence.split(',').filter(t => t.trim()) : []
        const mealTiming = med.pivot?.dosage || ""
        const duration = med.pivot?.duree || ""
        let p = med.name || "Médicament"
        if (times.length > 0) p += ` – 1 comprimé ${times.map(t => t.toLowerCase()).join(', ')}`
        if (mealTiming) p += `, ${mealTiming.toLowerCase()}`
        if (duration) p += `, pendant ${duration}`
        return p
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
       ${medications.map(m => `<div style="margin-bottom: 8px;">• ${getMedicationText(m)}</div>`).join('')}
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
        ${medications.length > 0 ? medications.map(m => `<div class="medication-item">• ${m.name || "Médicament"}</div>`).join("") : '<div class="medication-item" style="color: #999;">Aucun médicament prescrit</div>'}
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
      // Find the medicament name from available medicaments
      const med = availableMedicaments.find((m) => m.ID_Medicament.toString() === value)
      if (med) {
        updated[index].name = med.name
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
                {medications.map((med, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 p-4 bg-gray-50 rounded-lg border">
                    <div className="col-span-12 md:col-span-5">
                      <select
                        value={med.ID_Medicament}
                        onChange={(e) => updateMedication(index, "ID_Medicament", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner un médicament</option>
                        {availableMedicaments.map((medicament) => (
                          <option key={medicament.ID_Medicament} value={medicament.ID_Medicament}>
                            {medicament.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <Input
                        value={med.pivot.dosage}
                        onChange={(e) => updateMedication(index, "dosage", e.target.value)}
                        placeholder="Dosage"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <Input
                        value={med.pivot.frequence}
                        onChange={(e) => updateMedication(index, "frequence", e.target.value)}
                        placeholder="Fréquence"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-2">
                      <Input
                        value={med.pivot.duree}
                        onChange={(e) => updateMedication(index, "duree", e.target.value)}
                        placeholder="Durée"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-1 flex items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMedication(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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
