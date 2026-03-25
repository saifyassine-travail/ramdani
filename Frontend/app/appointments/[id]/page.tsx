"use client"

import type React from "react"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Textarea } from "../../../components/ui/textarea"
import { Badge } from "../../../components/ui/badge"
import { Popover, PopoverTrigger, PopoverContent } from "../../../components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../../../components/ui/command"
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
  ChevronsUpDown,
  Check,
  Stethoscope,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { apiClient, type Appointment, type Medicament, type Analysis } from "../../../lib/api"
import { formatGlobalDate } from "../../../lib/format-date"

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
  weight?: string | number | null
  tall?: string | number | null
  temperature?: string | number | null
  pulse?: string | number | null
  blood_pressure?: string | null
  custom_measures_values?: any
}

export default function AppointmentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const appointmentId = params.id as string

  const hasFetchedRef = useRef(false)
  const isLoadingRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [lastAppointment, setLastAppointment] = useState<LastAppointmentData | null>(null)
  const [availableMedicaments, setAvailableMedicaments] = useState<Medicament[]>([])
  const [availableAnalyses, setAvailableAnalyses] = useState<Analysis[]>([])

  // Settings Configuration for visibility
  const [caseConfig, setCaseConfig] = useState({
    show_weight: true,
    show_height: true,
    show_pulse: true,
    show_temperature: true,
    show_pressure: true,
    show_glycemia: true,
    custom_measures: [] as any[]
  })

  // Fetch settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiClient.getUserSettings()
        if (response.success) {
          const settingsData = response.data.data ? response.data.data : response.data;

          let parsedMeasures = [];
          if (settingsData.custom_measures) {
            try {
              parsedMeasures = typeof settingsData.custom_measures === 'string'
                ? JSON.parse(settingsData.custom_measures)
                : settingsData.custom_measures;
            } catch (e) {
              console.error("Failed to parse custom measures:", e);
            }
          }

          setCaseConfig({
            show_weight: settingsData.show_weight ?? true,
            show_height: settingsData.show_height ?? true,
            show_pulse: settingsData.show_pulse ?? true,
            show_temperature: settingsData.show_temperature ?? true,
            show_pressure: settingsData.show_pressure ?? true,
            show_glycemia: settingsData.show_glycemia ?? true,
            custom_measures: parsedMeasures
          })
        }
      } catch (error) {
        console.error("Error loading settings:", error)
      }
    }
    loadSettings()
  }, [])

  const [caseDescription, setCaseDescription] = useState("")
  const [diagnostic, setDiagnostic] = useState("")
  const [medications, setMedications] = useState<MedicationForm[]>([])
  const [analyses, setAnalyses] = useState<AnalysisForm[]>([])
  const [openMedicationDropdown, setOpenMedicationDropdown] = useState<number | null>(null)
  const [openAnalysisDropdown, setOpenAnalysisDropdown] = useState<number | null>(null)
  const [medicationSearchQuery, setMedicationSearchQuery] = useState("")

  const [vitalSigns, setVitalSigns] = useState({
    weight: "",
    pulse: "",
    temperature: "",
    blood_pressure: "",
    tall: "",
    notes: "",
    custom_measures_values: {} as Record<string, string>,
  })
  const [ddr, setDdr] = useState<string>("")

  // Medical Acts List
  const medicalActs = [
    { name: "Consultation", price: 250 },
    { name: "Aspiration", price: 2000 },
    { name: "CG", price: 0 },
    { name: "Échographie pelvienne", price: 400 },
    { name: "Scopie", price: 300 },
    { name: "Hysteroscopie (hscp)", price: 1500 },
    { name: "Vaginisme", price: 400 },
    { name: "Biopsie du sein", price: 700 },
    { name: "Biopsie du col", price: 700 },
    { name: "Polype", price: 500 },
    { name: "Stérilet au cuivre", price: 800 },
    { name: "Stérilet hormonal", price: 500 },
    { name: "Échographie mammaire", price: 400 },
    { name: "Insémination", price: 1000 },
    { name: "Contrôle", price: 0 },
  ]

  const [selectedActs, setSelectedActs] = useState<string[]>([])
  const [totalActsPrice, setTotalActsPrice] = useState(0)

  useEffect(() => {
    // If appointment type is "Contrôle", ensure "Consultation" is not selected 
    // or handled appropriately.
    // The user said "if its control disable it". 
    // We can interpret this as: if appointment.type is "Contrôle", 
    // disable the "Consultation" option or remove it from calculation.

    if (appointment?.type === "Contrôle" && selectedActs.includes("Consultation")) {
      setSelectedActs(prev => prev.filter(a => a !== "Consultation"))
    }

    const total = selectedActs.reduce((sum, actName) => {
      const act = medicalActs.find((a) => a.name === actName)
      return sum + (act ? act.price : 0)
    }, 0)
    setTotalActsPrice(total)
  }, [selectedActs, appointment?.type])

  const handleActToggle = (actName: string) => {
    if (appointment?.type === "Contrôle" && actName === "Consultation") {
      toast({
        title: "Action non autorisée",
        description: "La consultation est gratuite pour un contrôle.",
        variant: "destructive"
      })
      return
    }

    setSelectedActs((prev) =>
      prev.includes(actName) ? prev.filter((a) => a !== actName) : [...prev, actName]
    )
  }

  const handleUpdatePrice = async () => {
    try {
      setSaving(true)
      const response = await apiClient.updatePrice(Number(appointmentId), totalActsPrice, selectedActs)
      if (response.success) {
        toast({
          title: "Prix mis à jour",
          description: `Le prix de la consultation a été mis à jour à ${totalActsPrice} DH`,
        })
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le prix",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePrintOrdonnance = useCallback(() => {
    try {
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast({
          title: "Erreur",
          description: "Impossible d'ouvrir la fenêtre d'impression",
        })
        return
      }

      const medicationsPerPage = 8
      const page1Medications = medications.slice(0, medicationsPerPage)
      const page2Medications = medications.slice(medicationsPerPage)
      const hasMultiplePages = medications.length > medicationsPerPage

      const generateMedicationList = (meds: MedicationForm[]) => {
        return meds.length > 0
          ? meds
            .map((med) => {
              // Parse the data
              const times = med.pivot?.frequence ? med.pivot.frequence.split(',').filter(t => t.trim()) : []
              const mealTiming = med.pivot?.dosage || ""
              const duration = med.pivot?.duree || ""

              // Build readable prescription
              let prescription = med.name || "Médicament"

              // Add times (matin, soir, nuit)
              if (times.length > 0) {
                const timeText = times.map(t => t.toLowerCase()).join(', ')
                prescription += ` – 1 comprimé ${timeText}`
              }

              // Add meal timing
              if (mealTiming) {
                prescription += `, ${mealTiming.toLowerCase()}`
              }

              // Add duration
              if (duration) {
                prescription += `, pendant ${duration}`
              }

              return `
                  <div class="medication-item">• ${prescription}</div>
                `
            })
            .join("")
          : '<div class="medication-item" style="color: #999;">Aucun médicament prescrit</div>'
      }

      const ordonnanceHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Ordonnance</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: Arial, sans-serif; 
        font-size: 7px;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
      }
      .print-container { max-width: 800px; width: 100%; }
      .medication-list { display: flex; flex-direction: column; gap: 15px; }
      .medication-item { font-size: 12px; text-align: left; padding: 5px 10px; bold }
      .page-break { page-break-after: always; }
      .page { padding-top: 80px; }
      @media print {
        body { 
          padding: 20px; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          min-height: 100vh;
        }
        .print-container { max-width: 100%; }
        .page-break { page-break-after: always; }
        .page { padding-top: 80px; }
      }
    </style>
  </head>
  <body>
    <div class="print-container">
      <div class="page">
        <div class="medication-list">
          ${generateMedicationList(page1Medications)}
        </div>
      </div>
      ${hasMultiplePages
          ? `
        <div class="page-break"></div>
        <div class="page">
          <div class="medication-list">
            ${generateMedicationList(page2Medications)}
          </div>
        </div>
      `
          : ""
        }
    </div>
  </body>
</html>
      `

      printWindow.document.write(ordonnanceHTML)
      printWindow.document.close()

      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (error) {
      console.error("[v0] Error printing ordonnance:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors de l'impression de l'ordonnance",
      })
    }
  }, [medications, toast])

  const filteredMedicaments = useMemo(() => {
    // Deduplicate availableMedicaments by ID_Medicament
    const uniqueMedicaments = Array.from(
      new Map(availableMedicaments.map((m) => [m.ID_Medicament, m])).values()
    )

    if (!medicationSearchQuery) return uniqueMedicaments
    const query = medicationSearchQuery.toLowerCase()
    return uniqueMedicaments.filter((m) =>
      m.name.toLowerCase().includes(query)
    )
  }, [availableMedicaments, medicationSearchQuery])


  const handlePrintAnalyses = useCallback(() => {
    try {
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
      body { 
        font-family: Arial, sans-serif; 
        padding: 40px; 
        font-size: 7px;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        padding-top: px;
      }
      .print-container { max-width: 800px; width: 100%; }
      .analysis-list { display: flex; flex-direction: column; gap: 15px; }
      .analysis-item { font-size: 12px; text-align: left; padding: 5px 10px; font-weight: bold; }
      @media print {
        body { 
          padding: 20px; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          min-height: 100vh;
          padding-top: 80px;
        }
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
  }, [analyses, toast])

  useEffect(() => {
    if (hasFetchedRef.current || isLoadingRef.current) {
      return
    }

    const fetchData = async () => {
      try {
        isLoadingRef.current = true
        setLoading(true)
        setError(null)

        console.log("[v0] Fetching appointment data for ID:", appointmentId)

        const response = await apiClient.getEditData(Number(appointmentId))

        console.log("[v0] getEditData response:", response)

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

        if (!appt || !appt.ID_RV) {
          if (response.data.ID_RV) {
            appt = response.data
          } else {
            throw new Error("Appointment data not found in response")
          }
        }

        setAppointment(appt)
        if (appt.medical_acts && Array.isArray(appt.medical_acts)) {
          setSelectedActs(appt.medical_acts)
        }
        setAvailableMedicaments(available_medicaments || [])
        setAvailableAnalyses(available_analyses || [])

        const caseDescValue = appt?.case_description?.case_description || ""
        setCaseDescription(caseDescValue)

        setDiagnostic(appt?.diagnostic || "")

        let parsedCustomValues = {};
        if (appt?.case_description?.custom_measures_values) {
          try {
            parsedCustomValues = typeof appt.case_description.custom_measures_values === 'string'
              ? JSON.parse(appt.case_description.custom_measures_values)
              : appt.case_description.custom_measures_values;
          } catch (e) {
            console.error("Failed to parse custom_measures_values:", e);
          }
        }

        setVitalSigns({
          weight: appt?.case_description?.weight?.toString() || "",
          pulse: appt?.case_description?.pulse?.toString() || "",
          temperature: appt?.case_description?.temperature?.toString() || "",
          blood_pressure: appt?.case_description?.blood_pressure || "",
          tall: appt?.case_description?.tall?.toString() || "",
          notes: appt?.case_description?.notes || "",
          custom_measures_values: parsedCustomValues,
        })
        setDdr(appt?.patient?.DDR || "")

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

        if (appt?.analyses && Array.isArray(appt.analyses) && appt.analyses.length > 0) {
          setAnalyses(
            appt.analyses.map((analysis) => ({
              ID_Analyse: analysis?.ID_Analyse || "",
              name: analysis?.type_analyse || "",
            })),
          )
        }

        try {
          const lastResponse = await apiClient.getLastAppointmentInfo(Number(appointmentId))

          if (lastResponse.success && lastResponse.data) {
            const rawData = lastResponse.data as any

            const date = rawData.date || rawData.appointment_date || rawData.appointment?.appointment_date || ""
            const caseDesc = rawData.case_description || rawData.caseDescription || rawData.case?.case_description || ""

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

            let analyses = []
            if (Array.isArray(rawData.analyses)) {
              analyses = rawData.analyses
            } else if (rawData.data?.analyses && Array.isArray(rawData.data.analyses)) {
              analyses = rawData.data.analyses
            }

            let parsedCustomValues = null;
            if (rawData.custom_measures_values) {
              try {
                parsedCustomValues = typeof rawData.custom_measures_values === 'string'
                  ? JSON.parse(rawData.custom_measures_values)
                  : rawData.custom_measures_values;
              } catch (e) {
                console.error("Failed to parse previous custom_measures_values:", e);
              }
            }

            setLastAppointment({
              date,
              case_description: caseDesc,
              medicaments,
              analyses,
              weight: rawData.weight,
              tall: rawData.tall,
              temperature: rawData.temperature,
              pulse: rawData.pulse,
              blood_pressure: rawData.blood_pressure,
              custom_measures_values: parsedCustomValues,
            })
          }
        } catch (err) {
          console.error("[v0] Error fetching last appointment:", err)
        }

        hasFetchedRef.current = true
      } catch (err) {
        console.error("[v0] Error fetching appointment data:", err)
        setError(err instanceof Error ? err.message : "Failed to load appointment data")
      } finally {
        setLoading(false)
        isLoadingRef.current = false
      }
    }

    fetchData()
  }, [appointmentId])

  const addMedication = useCallback(() => {
    const newMedication: MedicationForm = {
      ID_Medicament: "",
      name: "",
      pivot: {
        dosage: "",
        frequence: "",
        duree: "",
      },
    }
    setMedications((prev) => [...prev, newMedication])
  }, [])

  const copyMedicamentFromLast = useCallback((medicament: LastAppointmentData["medicaments"][0]) => {
    const newMedication: MedicationForm = {
      ID_Medicament: medicament.id,
      name: medicament.name,
      pivot: {
        dosage: medicament.dosage || "",
        frequence: medicament.frequence || "",
        duree: medicament.duree || "",
      },
    }
    setMedications((prev) => [...prev, newMedication])
  }, [])

  const removeMedication = useCallback((index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateMedication = useCallback(
    (index: number, field: string, value: string) => {
      setMedications((prevMedications) => {
        const updated = [...prevMedications]
        if (field === "ID_Medicament") {
          updated[index].ID_Medicament = value
          const med = availableMedicaments.find((m) => m.ID_Medicament.toString() === value)
          if (med) {
            updated[index].name = med.name
          }
        } else if (field === "name") {
          updated[index].name = value
        } else {
          updated[index].pivot = { ...updated[index].pivot, [field]: value }
        }
        return updated
      })
    },
    [availableMedicaments],
  )

  const addAnalysis = useCallback(() => {
    const newAnalysis: AnalysisForm = {
      ID_Analyse: "",
      name: "",
    }
    setAnalyses((prev) => [...prev, newAnalysis])
  }, [])

  const copyAnalysisFromLast = useCallback((analysis: LastAppointmentData["analyses"][0]) => {
    const newAnalysis: AnalysisForm = {
      ID_Analyse: analysis.id,
      name: analysis.name,
    }
    setAnalyses((prev) => [...prev, newAnalysis])
  }, [])

  const removeAnalysis = useCallback((index: number) => {
    setAnalyses((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateAnalysis = useCallback(
    (index: number, field: string, value: string) => {
      setAnalyses((prevAnalyses) => {
        const updated = [...prevAnalyses]
        if (field === "ID_Analyse") {
          updated[index].ID_Analyse = value
          const analysis = availableAnalyses.find((a) => a.ID_Analyse.toString() === value)
          if (analysis) {
            updated[index].name = analysis.type_analyse
          }
        } else {
          updated[index] = { ...updated[index], [field]: value }
        }
        return updated
      })
    },
    [availableAnalyses],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      try {
        setSaving(true)
        setError(null)

        const medicamentsData = medications
          .filter((med) => med.ID_Medicament && med.ID_Medicament !== "")
          .map((med) => ({
            ID_Medicament: Number(med.ID_Medicament),
            dosage: med.pivot.dosage,
            frequence: med.pivot.frequence,
            duree: med.pivot.duree,
          }))

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
          spo2: null,
          DDR: ddr || undefined,
          notes: vitalSigns.notes || undefined,
          custom_measures_values: vitalSigns.custom_measures_values,
          diagnostic: diagnostic || "",
          medicaments: medicamentsData,
          analyses: analysesData,
        }

        const response = await apiClient.updateAppointmentDetails(Number(appointmentId), requestData)

        if (!response.success) {
          throw new Error(response.message || "Failed to save appointment details")
        }

        const cacheKey = `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/appointments/${appointmentId}/edit-data`
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`api-cache-${cacheKey}`)
        }

        toast({
          title: "Succès",
          description: "Détails du rendez-vous sauvegardés avec succès!",
        })

        setTimeout(() => {
          router.push("/medecin")
        }, 500)
      } catch (err) {
        console.error("[v0] Error saving appointment:", err)
        setError(err instanceof Error ? err.message : "Failed to save appointment details")
        toast({
          title: "Erreur",
          description: err instanceof Error ? err.message : "Erreur lors de la sauvegarde",
          variant: "destructive",
        })
      } finally {
        setSaving(false)
      }
    },
    [appointmentId, medications, analyses, caseDescription, vitalSigns, ddr, diagnostic, toast, router],
  )

  const formatDate = (dateString: string) => {
    return formatGlobalDate(dateString)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getBorderColor = (value: string | null) => {
    switch (value) {
      case "-+":
        return "border-green-500 bg-green-50"
      case "+":
        return "border-yellow-500 bg-yellow-50"
      case "++":
        return "border-orange-500 bg-orange-50"
      case "+++":
        return "border-red-500 bg-red-50"
      default:
        return "border-gray-300"
    }
  }

  const calculateBMI = (weight: number, height: number) => {
    if (!weight || !height || height === 0) return null
    const heightInMeters = height / 100
    return weight / (heightInMeters * heightInMeters)
  }

  const getBMIColor = useCallback((bmi: number | null) => {
    if (!bmi) return "text-gray-500"
    if (bmi < 18.5) return "text-blue-600"
    if (bmi < 25) return "text-green-600"
    if (bmi < 30) return "text-orange-600"
    return "text-red-600"
  }, [])

  const getBMIStatus = (bmi: number | null) => {
    if (!bmi) return "N/A"
    if (bmi < 18.5) return "Insuffisance pondérale"
    if (bmi < 25) return "Normal"
    if (bmi < 30) return "Surpoids"
    return "Obésité"
  }

  const getTemperatureColor = useCallback((temp: number | null) => {
    if (!temp) return "border-gray-300"
    if (temp >= 36.5 && temp <= 37.5) return "border-green-500 bg-green-50"
    if ((temp >= 36 && temp < 36.5) || (temp > 37.5 && temp <= 38)) return "border-yellow-500 bg-yellow-50"
    if ((temp >= 35.5 && temp < 36) || (temp > 38 && temp <= 38.5)) return "border-orange-500 bg-orange-50"
    return "border-red-500 bg-red-50"
  }, [])

  const getPulseColor = useCallback((pulse: number | null) => {
    if (!pulse) return "border-gray-300"
    if (pulse >= 60 && pulse <= 100) return "border-green-500 bg-green-50"
    if ((pulse >= 50 && pulse < 60) || (pulse > 100 && pulse <= 110)) return "border-yellow-500 bg-yellow-50"
    if ((pulse >= 40 && pulse < 50) || (pulse > 110 && pulse <= 120)) return "border-orange-500 bg-orange-50"
    return "border-red-500 bg-red-50"
  }, [])

  const getTensionColor = useCallback((bloodPressure: string | null) => {
    if (!bloodPressure) return "border-gray-300"

    const [systolic, diastolic] = bloodPressure.split("/").map(Number)
    if (!systolic || !diastolic) return "border-gray-300"

    if (systolic < 120 && diastolic < 80) return "border-green-500 bg-green-50"
    if (systolic >= 120 && systolic <= 129 && diastolic < 80) return "border-yellow-500 bg-yellow-50"
    if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89))
      return "border-orange-500 bg-orange-50"
    return "border-red-500 bg-red-50"
  }, [])

  const getGlycimideColor = useCallback((value: number | null) => {
    if (!value) return "border-gray-300"
    if (value < 70) return "border-blue-500 bg-blue-50"
    if (value >= 70 && value <= 99) return "border-green-500 bg-green-50"
    if (value >= 100 && value <= 125) return "border-orange-500 bg-orange-50"
    return "border-red-500 bg-red-50"
  }, [])

  const getGlycimideStatus = (value: number | null) => {
    if (!value) return "N/A"
    if (value < 70) return "Basse (hypoglycémie)"
    if (value >= 70 && value <= 99) return "Normale"
    if (value >= 100 && value <= 125) return "Élevée (pré-diabète)"
    return "Très élevée (diabète)"
  }

  const bmi = useMemo(
    () =>
      calculateBMI(vitalSigns.weight ? Number(vitalSigns.weight) : 0, vitalSigns.tall ? Number(vitalSigns.tall) : 0),
    [vitalSigns.weight, vitalSigns.tall],
  )


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
    <div className="p-4 max-w-[1800px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Détails du Rendez-vous</h1>
          <div className="flex items-center mt-1 text-gray-600">
            <User className="w-4 h-4 mr-2" />
            <span className="font-medium">{`${appointment.patient.first_name} ${appointment.patient.last_name}`}</span>
          </div>
        </div>

        {/* Medical Acts Checklist Section */}
        <div className="mt-4 md:mt-0 md:ml-auto mr-6">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 gap-2">
                <Stethoscope className="h-4 w-4" />
                Actes Médicaux
                <Badge className="ml-2 bg-pink-100 text-pink-700 hover:bg-pink-200 border-0">
                  {totalActsPrice} DH
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 bg-pink-50 border-b border-pink-100">
                <h4 className="font-medium text-pink-900 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Actes Médicaux
                </h4>
                <p className="text-xs text-pink-600 mt-1">Sélectionnez les actes effectués</p>
              </div>
              <div className="p-2 max-h-[300px] overflow-y-auto">
                {medicalActs.map((act) => (
                  <div
                    key={act.name}
                    onClick={() => handleActToggle(act.name)}
                    className={`
                        cursor-pointer rounded-md p-2 flex items-center justify-between transition-colors
                        ${selectedActs.includes(act.name)
                        ? "bg-pink-50 text-pink-900"
                        : "hover:bg-gray-50 text-gray-700"}
                        ${appointment?.type === "Contrôle" && act.name === "Consultation" ? "opacity-50 cursor-not-allowed" : ""}
                      `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`
                          w-4 h-4 rounded border flex items-center justify-center transition-colors
                          ${selectedActs.includes(act.name) ? "bg-pink-500 border-pink-500" : "border-gray-300 bg-white"}
                        `}>
                        {selectedActs.includes(act.name) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm">{act.name}</span>
                    </div>
                    <span className="text-xs font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                      {act.price} DH
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t bg-gray-50 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleUpdatePrice}
                  className="bg-pink-600 hover:bg-pink-700 text-white w-full"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    `Appliquer (${totalActsPrice} DH)`
                  )}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Description du Cas - 3 columns */}
          <div className="xl:col-span-3 space-y-6">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 py-4">
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
              <CardContent className="p-4 space-y-4">
                <Textarea
                  value={caseDescription}
                  onChange={(e) => setCaseDescription(e.target.value)}
                  placeholder="Décrivez les plaintes et symptômes du patient..."
                  className="min-h-[120px] resize-y text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300"
                  rows={4}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {caseConfig.show_height && (
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Taille (cm)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={vitalSigns.tall}
                        onChange={(e) => setVitalSigns({ ...vitalSigns, tall: e.target.value })}
                        className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  )}
                  {caseConfig.show_weight && (
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Poids (kg)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={vitalSigns.weight}
                        onChange={(e) => setVitalSigns({ ...vitalSigns, weight: e.target.value })}
                        className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  )}
                  {caseConfig.show_temperature && (
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Température (°C)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={vitalSigns.temperature}
                        onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                        className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  )}
                  {caseConfig.show_pulse && (
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Pouls (bpm)</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={vitalSigns.pulse}
                        onChange={(e) => setVitalSigns({ ...vitalSigns, pulse: e.target.value })}
                        className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  )}
                  {caseConfig.show_pressure && (
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Tension Artérielle</label>
                      <Input
                        type="text"
                        value={vitalSigns.blood_pressure}
                        onChange={(e) => setVitalSigns({ ...vitalSigns, blood_pressure: e.target.value })}
                        placeholder="ex: 120/80"
                        className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  )}

                  {caseConfig.custom_measures && caseConfig.custom_measures.map((measure, idx) => {
                    const measureKey = measure.name;
                    const val = vitalSigns.custom_measures_values[measureKey] || vitalSigns.custom_measures_values[measure.short] || "";
                    const numVal = parseFloat(val);
                    let colorClass = "border-gray-200 focus-visible:ring-blue-500 placeholder:text-blue-300";

                    if (val && !isNaN(numVal)) {
                      if (measure.min_value && numVal < parseFloat(measure.min_value)) {
                        colorClass = `border-${measure.color}-500 bg-${measure.color}-50 text-${measure.color}-700`;
                      } else if (measure.max_value && numVal > parseFloat(measure.max_value)) {
                        colorClass = `border-${measure.color}-500 bg-${measure.color}-50 text-${measure.color}-700`;
                      } else {
                        colorClass = "border-green-500 bg-green-50 text-green-700";
                      }
                    }

                    return (
                      <div key={idx}>
                        <label className="block text-xs font-medium text-blue-700 mb-1">
                          {measure.name} {measure.short ? `(${measure.short})` : ''}
                        </label>
                        <Input
                          type="text"
                          value={val}
                          onChange={(e) => setVitalSigns({
                            ...vitalSigns,
                            custom_measures_values: {
                              ...vitalSigns.custom_measures_values,
                              [measureKey]: e.target.value
                            }
                          })}
                          placeholder={`Min: ${measure.min_value} | Max: ${measure.max_value}`}
                          className={`h-8 border-2 ${colorClass} bg-blue-50/50`}
                        />
                      </div>
                    );
                  })}
                  {/* DDR Field */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-blue-700 mb-1">DDR (Date des Dernières Règles)</label>
                    <Input
                      type="date"
                      value={ddr}
                      onChange={(e) => setDdr(e.target.value)}
                      className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500"
                    />
                    {ddr && (() => {
                      const ddrDate = new Date(ddr)
                      const today = new Date()
                      today.setHours(0, 0, 0, 0) // Reset time to compare dates only
                      ddrDate.setHours(0, 0, 0, 0)

                      // Check if DDR is in the future
                      if (ddrDate > today) {
                        return (
                          <div className="mt-2 p-3 rounded-lg border-2 bg-red-50 border-red-300">
                            <div className="flex items-center gap-2">
                              <span className="text-red-700 text-xs font-bold">⚠️ Erreur:</span>
                              <span className="text-red-600 text-xs">La DDR ne peut pas être dans le futur</span>
                            </div>
                          </div>
                        )
                      }

                      const diffMs = today.getTime() - ddrDate.getTime()
                      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                      const weeks = Math.floor(Math.abs(diffDays) / 7)
                      const days = Math.abs(diffDays) % 7

                      // Calculate DPA (Naegele's Rule: DDR + 1 year - 3 months + 7 days)
                      const dpa = new Date(ddrDate)
                      dpa.setFullYear(dpa.getFullYear() + 1)
                      dpa.setMonth(dpa.getMonth() - 3)
                      dpa.setDate(dpa.getDate() + 7)

                      // Determine trimester and color
                      let trimester = ""
                      let bgColor = ""
                      let textColor = ""
                      let borderColor = ""

                      if (weeks <= 12) {
                        trimester = "1er Trimestre"
                        bgColor = "bg-green-50"
                        textColor = "text-green-700"
                        borderColor = "border-green-300"
                      } else if (weeks <= 27) {
                        trimester = "2ème Trimestre"
                        bgColor = "bg-yellow-50"
                        textColor = "text-yellow-700"
                        borderColor = "border-yellow-300"
                      } else if (weeks <= 40) {
                        trimester = "3ème Trimestre"
                        bgColor = "bg-orange-50"
                        textColor = "text-orange-700"
                        borderColor = "border-orange-300"
                      } else {
                        trimester = "Post-terme"
                        bgColor = "bg-red-50"
                        textColor = "text-red-700"
                        borderColor = "border-red-300"
                      }

                      return (
                        <div className={`mt-2 p-3 rounded-lg border-2 ${bgColor} ${borderColor}`}>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${textColor}`}>
                                🤰 {weeks} SA + {days}j
                              </span>
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${bgColor} ${textColor} border ${borderColor}`}>
                                {trimester}
                              </span>
                            </div>

                            <div className={`text-xs ${textColor} font-medium`}>
                              📅 DPA: {dpa.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>

                            {weeks <= 40 && (
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${weeks <= 12 ? 'bg-green-500' :
                                    weeks <= 27 ? 'bg-yellow-500' :
                                      'bg-orange-500'
                                    }`}
                                  style={{ width: `${Math.min((weeks / 40) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-blue-700 mb-1">Notes</label>
                    <Input
                      value={vitalSigns.notes}
                      onChange={(e) => setVitalSigns({ ...vitalSigns, notes: e.target.value })}
                      placeholder="Observations supplémentaires"
                      className="h-8 text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">Diagnostic</label>
                  <Textarea
                    value={diagnostic}
                    onChange={(e) => setDiagnostic(e.target.value)}
                    placeholder="Diagnostic du patient..."
                    className="min-h-[100px] resize-y text-blue-700 bg-blue-50/50 border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MIDDLE COLUMN: Plan de Traitement & Demandes d'Analyses - 6 columns */}
          <div className="xl:col-span-6 space-y-6">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-blue-700 flex items-center">
                    <Pills className="w-5 h-5 mr-3" />
                    Plan de Traitement
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-green-500 text-white hover:bg-green-600"
                      onClick={handlePrintOrdonnance}
                    >
                      <Print className="w-3 h-3 mr-1" />
                      Imprimer
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="space-y-3">
                    {medications.map((med, medIndex) => (
                      <div key={medIndex} className="p-3 bg-gray-50 rounded-lg border text-sm">
                        <div className="mb-2">
                          <Popover
                            open={openMedicationDropdown === medIndex}
                            onOpenChange={(open) => {
                              setOpenMedicationDropdown(open ? medIndex : null)
                              if (!open) setMedicationSearchQuery("")
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full flex justify-between items-center px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-left bg-white hover:bg-gray-50 h-9"
                              >
                                <span className="text-gray-700 truncate">
                                  {med.ID_Medicament
                                    ? availableMedicaments.find(
                                      (m) => m.ID_Medicament.toString() === med.ID_Medicament.toString(),
                                    )?.name || med.name
                                    : "Sélectionner..."}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Rechercher..."
                                  value={medicationSearchQuery}
                                  onValueChange={setMedicationSearchQuery}
                                />
                                <CommandList>
                                  <CommandEmpty>Aucun résultat.</CommandEmpty>
                                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                                    {filteredMedicaments.slice(0, 100).map((medicament) => (
                                      <CommandItem
                                        key={medicament.ID_Medicament}
                                        onSelect={() => {
                                          updateMedication(medIndex, "ID_Medicament", medicament.ID_Medicament.toString())
                                          setOpenMedicationDropdown(null)
                                          setMedicationSearchQuery("")
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            medicament.ID_Medicament.toString() === med.ID_Medicament.toString()
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {medicament.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2 mb-2 p-2 bg-blue-50/30 rounded-lg border border-blue-100">


                          {/* Time of day checkboxes - Enhanced Design */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 bg-white rounded-lg border-2 border-blue-200 shadow-sm">
                            <label className="flex items-center gap-2 cursor-pointer group hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={med.pivot.frequence?.includes("Matin") || false}
                                onChange={(e) => {
                                  const current = med.pivot.frequence || ""
                                  const times = current.split(",").map(t => t.trim()).filter(t => t)
                                  if (e.target.checked) {
                                    if (!times.includes("Matin")) updateMedication(medIndex, "frequence", [...times, "Matin"].join(","))
                                  } else {
                                    updateMedication(medIndex, "frequence", times.filter(t => t !== "Matin").join(","))
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-2 border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
                              />
                              <span className="text-xs font-semibold text-blue-700 select-none">Matin</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={med.pivot.frequence?.includes("Midi") || false}
                                onChange={(e) => {
                                  const current = med.pivot.frequence || ""
                                  const times = current.split(",").map(t => t.trim()).filter(t => t)
                                  if (e.target.checked) {
                                    if (!times.includes("Midi")) updateMedication(medIndex, "frequence", [...times, "Midi"].join(","))
                                  } else {
                                    updateMedication(medIndex, "frequence", times.filter(t => t !== "Midi").join(","))
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-2 border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
                              />
                              <span className="text-xs font-semibold text-blue-700 select-none">Midi</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors">
                              <input
                                type="checkbox"
                                checked={med.pivot.frequence?.includes("Soir") || false}
                                onChange={(e) => {
                                  const current = med.pivot.frequence || ""
                                  const times = current.split(",").map(t => t.trim()).filter(t => t)
                                  if (e.target.checked) {
                                    if (!times.includes("Soir")) updateMedication(medIndex, "frequence", [...times, "Soir"].join(","))
                                  } else {
                                    updateMedication(medIndex, "frequence", times.filter(t => t !== "Soir").join(","))
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-2 border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
                              />
                              <span className="text-xs font-semibold text-blue-700 select-none">Soir</span>
                            </label>
                          </div>

                          {/* Duration and Meal timing in same row for space */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                value={med.pivot.duree?.match(/\d+/)?.[0] || ""}
                                onChange={(e) => {
                                  const unit = med.pivot.duree?.includes("mois") ? "mois" : "jours"
                                  updateMedication(medIndex, "duree", e.target.value ? `${e.target.value} ${unit}` : "")
                                }}
                                placeholder="D"
                                title="Durée"
                                className="h-7 text-[10px] w-12 px-1 border-blue-200"
                              />
                              <select
                                value={med.pivot.duree?.includes("mois") ? "mois" : "jours"}
                                onChange={(e) => {
                                  const number = med.pivot.duree?.match(/\d+/)?.[0] || ""
                                  updateMedication(medIndex, "duree", number ? `${number} ${e.target.value}` : "")
                                }}
                                className="h-7 text-[10px] border border-blue-200 rounded px-1 flex-1 bg-white text-blue-700"
                              >
                                <option value="jours">jours</option>
                                <option value="mois">mois</option>
                              </select>
                            </div>

                            <select
                              value={med.pivot.dosage || ""}
                              onChange={(e) => updateMedication(medIndex, "dosage", e.target.value)}
                              className="h-7 text-[10px] border border-blue-200 rounded px-1 bg-white text-blue-700"
                            >
                              <option value="">Repas...</option>
                              <option value="Avant repas">Av. repas</option>
                              <option value="Milieu de repas">Mil. repas</option>
                              <option value="Après repas">Ap. repas</option>
                            </select>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMedication(medIndex)}
                          className="w-full h-6 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addMedication}
                    className="w-full bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 h-9 text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter Médicament
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-blue-700 flex items-center">
                    <Flask className="w-5 h-5 mr-3" />
                    Analyses
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-green-500 text-white hover:bg-green-600"
                    onClick={handlePrintAnalyses}
                  >
                    <Print className="w-3 h-3 mr-1" />
                    Imprimer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="space-y-3">
                    {analyses.map((analysis, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
                        <div className="flex-grow">
                          <Popover
                            open={openAnalysisDropdown === index}
                            onOpenChange={(open) => {
                              setOpenAnalysisDropdown(open ? index : null)
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full flex justify-between items-center px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-left bg-white hover:bg-gray-50 h-8 text-sm"
                              >
                                <span className="text-gray-700 truncate">
                                  {analysis.ID_Analyse
                                    ? availableAnalyses.find(
                                      (a) => a.ID_Analyse.toString() === analysis.ID_Analyse.toString(),
                                    )?.type_analyse || analysis.name
                                    : "Sélectionner..."}
                                </span>
                                <ChevronsUpDown className="h-3 w-3 opacity-50 flex-shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Rechercher..." />
                                <CommandList>
                                  <CommandEmpty>Aucun résultat.</CommandEmpty>
                                  <CommandGroup>
                                    {availableAnalyses.map((availableAnalysis) => (
                                      <CommandItem
                                        key={availableAnalysis.ID_Analyse}
                                        onSelect={() => {
                                          updateAnalysis(index, "ID_Analyse", availableAnalysis.ID_Analyse.toString())
                                          setOpenAnalysisDropdown(null)
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            availableAnalysis.ID_Analyse.toString() === analysis.ID_Analyse.toString()
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        {availableAnalysis.type_analyse}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAnalysis(index)}
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
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
                    className="w-full bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 h-9 text-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter Analyse
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Rendez-vous précédent - 3 columns */}
          <div className="xl:col-span-3 space-y-6">
            {lastAppointment ? (
              <Card className="border-l-4 border-l-blue-500 h-full">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 py-4">
                  <CardTitle className="text-lg text-blue-700 flex items-center">
                    <History className="w-5 h-5 mr-3" />
                    Rendez-vous précédent
                  </CardTitle>
                  <p className="text-xs text-gray-500 ml-8">{lastAppointment.date}</p>
                </CardHeader>
                <CardContent className="p-4">
                  {!lastAppointment.case_description &&
                    (!lastAppointment.medicaments || lastAppointment.medicaments.length === 0) &&
                    (!lastAppointment.analyses || lastAppointment.analyses.length === 0) ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">Aucune donnée disponible.</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 space-y-4">
                      {lastAppointment.case_description && (
                        <div className="p-3 bg-gray-50 rounded border">
                          <strong className="block text-gray-800 mb-1">Notes du cas:</strong>
                          <p className="whitespace-pre-wrap">{lastAppointment.case_description}</p>
                        </div>
                      )}

                      {(lastAppointment.tall || lastAppointment.weight || lastAppointment.temperature || lastAppointment.pulse || lastAppointment.blood_pressure || (lastAppointment.custom_measures_values && Object.keys(lastAppointment.custom_measures_values).length > 0)) && (
                        <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                          <strong className="block text-blue-800 mb-2">Constantes vitales:</strong>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {lastAppointment.tall && <div><span className="text-gray-500">Taille:</span> <span className="font-medium text-gray-900">{lastAppointment.tall} cm</span></div>}
                            {lastAppointment.weight && <div><span className="text-gray-500">Poids:</span> <span className="font-medium text-gray-900">{lastAppointment.weight} kg</span></div>}
                            {lastAppointment.temperature && <div><span className="text-gray-500">Temp:</span> <span className="font-medium text-gray-900">{lastAppointment.temperature} °C</span></div>}
                            {lastAppointment.pulse && <div><span className="text-gray-500">Pouls:</span> <span className="font-medium text-gray-900">{lastAppointment.pulse} bpm</span></div>}
                            {lastAppointment.blood_pressure && <div><span className="text-gray-500">Tension:</span> <span className="font-medium text-gray-900">{lastAppointment.blood_pressure}</span></div>}

                            {lastAppointment.custom_measures_values && Object.entries(lastAppointment.custom_measures_values).map(([mName, mValue]) => (
                              mValue && <div key={mName}><span className="text-gray-500">{mName}:</span> <span className="font-medium text-gray-900">{String(mValue)}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lastAppointment.medicaments && lastAppointment.medicaments.length > 0 && (
                        <div>
                          <strong className="block mb-2 text-gray-800">Médicaments:</strong>
                          <div className="space-y-2">
                            {lastAppointment.medicaments.map((med) => (
                              <div key={med.id} className="flex flex-col bg-white p-2 rounded border shadow-sm">
                                <div className="flex justify-between items-start">
                                  <span className="font-medium text-gray-900">{med.name}</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyMedicamentFromLast(med)}
                                    className="h-6 w-6 p-0 text-green-600 hover:bg-green-50"
                                    title="Copier"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                                <span className="text-xs text-blue-600 font-medium mt-1">
                                  {(() => {
                                    const times = med.frequence ? med.frequence.split(',').filter(t => t.trim()) : []
                                    const meal = med.dosage || ""
                                    const dur = med.duree || ""

                                    let text = "1 comprimé"
                                    if (times.length > 0) text += ` ${times.map(t => t.toLowerCase()).join(', ')}`
                                    if (meal) text += `, ${meal.toLowerCase()}`
                                    if (dur) text += `, pendant ${dur}`

                                    return text
                                  })()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lastAppointment.analyses && lastAppointment.analyses.length > 0 && (
                        <div>
                          <strong className="block mb-2 text-gray-800">Analyses:</strong>
                          <div className="space-y-2">
                            {lastAppointment.analyses.map((analysis) => (
                              <div
                                key={analysis.id}
                                className="flex items-center justify-between bg-white p-2 rounded border shadow-sm"
                              >
                                <span>{analysis.name}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyAnalysisFromLast(analysis)}
                                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-50"
                                  title="Copier"
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
            ) : (
              <Card className="h-full border-dashed">
                <CardContent className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
                  <p>Aucun rendez-vous précédent</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-6 pb-8">
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
      </form >
    </div >
  )
}