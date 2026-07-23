"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import PlanControlModal from "@/components/plan-control-modal"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Edit, User, Phone, Mail, FileText, AlertCircle, Heart, Calendar, CalendarCheck, History, Search, Zap, FileCheck, BarChart3, Clock, Plus, Save, Trash2, Printer, Shield, Check, Download, Upload, FileUp, Receipt } from 'lucide-react'
import { apiClient, resolveDocumentBackgroundUrl, type PatientDocument } from "@/lib/api"
import { formatGlobalDate } from "@/lib/format-date"
import { formatName } from "@/lib/utils"
import { isMinor } from "@/lib/age"
import { useAuth } from "@/hooks/use-auth"
import FacturePrintPreview from "@/components/facture-print-preview"
import CertificatePrintPreview from "@/components/certificate-print-preview"
import { renderCertificateTemplate } from "@/lib/certificate-template"

interface PatientDetails {
  ID_patient: number
  first_name: string
  last_name: string
  birth_day: string
  gender: string
  CIN?: string | null
  guardian_cin?: string | null
  guardian_relation?: string | null
  phone_num: string
  email?: string
  mutuelle?: string
  allergies?: string
  chronic_conditions?: string
  notes?: string
  blood_type?: string
  photo_base64?: string | null
  archived: boolean
  lastAppointment?: {
    appointment_date: string
    type?: string
    diagnostic?: string
  }
  nextAppointment?: {
    appointment_date: string
  }
  appointmentsHistory?: Array<{
    ID_RV: number
    appointment_date: string
    type?: string
    payement?: number
    mutuelle?: boolean
    medical_acts?: string[]
    credit?: number
  }>
  certificates?: Array<{
    ID_CM: number
    start_date: string
    end_date: string
    content: string
  }>
  documents?: PatientDocument[]
}

export default function PatientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const patientId = Number.parseInt(params.id as string)
  const { toast } = useToast()
  const { user } = useAuth()

  // Lazily-loaded settings (facture layout/background, medical act prices,
  // certificate template, practice identity) — shared by the facture and
  // certificate print flows. Fetched once on first use.
  const [docSettings, setDocSettings] = useState<any | null>(null)
  const [factureAppointment, setFactureAppointment] = useState<any | null>(null)
  const [factureOpen, setFactureOpen] = useState(false)
  const [certificatePreviewOpen, setCertificatePreviewOpen] = useState(false)
  const [certificateBody, setCertificateBody] = useState("")

  const [patient, setPatient] = useState<PatientDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false)
  const [confirmControlOpen, setConfirmControlOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAvatarZoomed, setIsAvatarZoomed] = useState(false)
  const [savingAppointmentId, setSavingAppointmentId] = useState<number | null>(null)
  const [savingMutuelleId, setSavingMutuelleId] = useState<number | null>(null)
  const [savingCreditId, setSavingCreditId] = useState<number | null>(null)
  const [loadingMedicaments, setLoadingMedicaments] = useState(false)
  const [isControlModalOpen, setIsControlModalOpen] = useState(false)
  const [controlDays, setControlDays] = useState(90)
  const [controlDate, setControlDate] = useState("")
  const [controlDayCount, setControlDayCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [submittingControl, setSubmittingControl] = useState(false)
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const countDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const priceDebounceTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const creditDebounceTimers = useRef<Record<number, NodeJS.Timeout>>({})

  // Calculate target date from number of days, skipping Saturday & Sunday
  const getControlDateFromDays = (days: number): string => {
    if (!days || days < 1) return ""
    const d = new Date()
    d.setDate(d.getDate() + days)
    const day = d.getDay()
    if (day === 6) d.setDate(d.getDate() + 2)      // Saturday → Monday
    else if (day === 0) d.setDate(d.getDate() + 1) // Sunday → Monday
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  // Fetch appointment count whenever the computed date changes
  useEffect(() => {
    if (!isControlModalOpen || !controlDate) {
      setControlDayCount(null)
      return
    }
    setLoadingCount(true)
    clearTimeout(countDebounceRef.current)
    countDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.getAppointmentCountByDate(controlDate)
        const data = (res as any).data
        setControlDayCount(data?.count ?? 0)
      } catch {
        setControlDayCount(null)
      } finally {
        setLoadingCount(false)
      }
    }, 350)
  }, [controlDate, isControlModalOpen])

  useEffect(() => {
    const fetchPatientDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.getPatient(patientId)

        if (response.success && response.data) {
          // Handle both direct patient data and nested structure from your controller
          const patientData = response.data.patient || response.data
          const appointmentsHistory = response.data.appointmentsHistory || []
          const lastAppointment = response.data.lastAppointment
          const nextAppointment = response.data.nextAppointment

          let certificates: any[] = patientData.certificates || []

          // If no certificates in patient data, fetch them separately
          if (certificates.length === 0) {
            try {
              const certificatesResponse = await apiClient.getCertificates(patientId)
              if (certificatesResponse.success && certificatesResponse.data) {
                certificates = Array.isArray(certificatesResponse.data)
                  ? certificatesResponse.data
                  : (certificatesResponse.data.certificates || [])
              }
            } catch (certError) {
              console.error("[v0] Error fetching certificates:", certError)
            }
          }

          const transformedPatient: PatientDetails = {
            ID_patient: patientData.ID_patient,
            first_name: patientData.first_name,
            last_name: patientData.last_name,
            birth_day: patientData.birth_day,
            gender: patientData.gender,
            CIN: patientData.CIN,
            guardian_cin: patientData.guardian_cin,
            guardian_relation: patientData.guardian_relation,
            phone_num: patientData.phone_num,
            email: patientData.email,
            mutuelle: patientData.mutuelle,
            allergies: patientData.allergies,
            chronic_conditions: patientData.chronic_conditions,
            notes: patientData.notes,
            blood_type: patientData.blood_type,
            photo_base64: patientData.photo_base64,
            archived: Boolean(patientData.archived),
            lastAppointment: lastAppointment,
            nextAppointment: nextAppointment,
            appointmentsHistory: appointmentsHistory,
            certificates: certificates,
          }

          setPatient(transformedPatient)
        } else {
          console.error("Failed to fetch patient details:", response)
          setError("Impossible de charger les détails du patient")
        }
      } catch (err) {
        console.error("Error fetching patient details:", err)
        setError("Erreur réseau")
      } finally {
        setLoading(false)
      }
    }

    const fetchDocuments = async () => {
      try {
        const response = await apiClient.getPatientDocuments(patientId)
        if (response.success && response.data) {
          setDocuments(Array.isArray(response.data) ? response.data : [])
        }
      } catch (err) {
        console.error("[v0] Error fetching documents:", err)
      }
    }

    if (patientId) {
      fetchPatientDetails()
      fetchDocuments()
    }
  }, [patientId])

  const calculateAge = useCallback((birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    const ageInYears = today.getFullYear() - birth.getFullYear()
    const ageInMonths = today.getMonth() - birth.getMonth()
    const ageInDays = today.getDate() - birth.getDate()

    if (ageInYears < 1) {
      if (ageInMonths < 1) {
        return `${Math.abs(ageInDays)} jour${Math.abs(ageInDays) > 1 ? "s" : ""}`
      } else {
        return `${Math.abs(ageInMonths)} mois`
      }
    }
    return `${ageInYears} ans`
  }, [])

  const formatDate = useCallback((dateString: string) => {
    return formatGlobalDate(dateString)
  }, [])

  const filteredAppointments = useMemo(() => {
    return (
      patient?.appointmentsHistory?.filter((appointment: any) =>
        formatDate(appointment.appointment_date).toLowerCase().includes(searchTerm.toLowerCase()),
      ) || []
    )
  }, [patient?.appointmentsHistory, searchTerm, formatDate])

  const handleEditPatient = useCallback(
    async (formData: any) => {
      try {
        const response = await apiClient.updatePatient(patientId, formData)

        if (response.success) {
          // Update local state with new data
          setPatient((prev: any) => ({ ...prev, ...formData }))
          setIsEditModalOpen(false)
        } else {
          console.error("Failed to update patient:", response)
          setError("Impossible de mettre à jour le patient")
        }
      } catch (err) {
        console.error("Error updating patient:", err)
        setError("Erreur réseau lors de la mise à jour du patient")
      }
    },
    [patientId],
  )

  const handleControlResult = useCallback(
    async (success: boolean, message: string) => {
      if (success) {
        toast({ title: "Succès", description: message })
        // Refresh appointment data so the new control shows up
        const refreshed = await apiClient.getPatient(patientId)
        if (refreshed.success && refreshed.data) {
          const data: any = refreshed.data
          setPatient((prev: any) =>
            prev
              ? {
                  ...prev,
                  appointmentsHistory: data.appointmentsHistory || prev.appointmentsHistory,
                  nextAppointment: data.nextAppointment || prev.nextAppointment,
                }
              : prev,
          )
        }
      } else {
        toast({ title: "Erreur", description: message, variant: "destructive" })
      }
    },
    [patientId, toast],
  )

  const handleAddCertificate = useCallback(
    async (certificateData: any) => {
      try {
        const response = await apiClient.createCertificate(patientId, certificateData)

        if (response.success) {
          const newCertificate = response.data
          setPatient((prev: any) => {
            const updatedCerts = Array.isArray(prev.certificates) ? [...prev.certificates] : []
            if (newCertificate && newCertificate.ID_CM) {
              updatedCerts.push(newCertificate)
            }
            return { ...prev, certificates: updatedCerts }
          })

          // Also fetch the complete list to ensure consistency. getCertificates
          // returns { success, certificates: [...] }, so unwrap to the array.
          // skipCache=true — otherwise the 30s response cache would return the
          // list from before this certificate existed.
          const certificatesResponse = await apiClient.getCertificates(patientId, true)
          if (certificatesResponse.success && certificatesResponse.data) {
            const certs = Array.isArray(certificatesResponse.data)
              ? certificatesResponse.data
              : ((certificatesResponse.data as any).certificates || [])
            setPatient((prev: any) => ({
              ...prev,
              certificates: certs,
            }))
          }

          setIsCertificateModalOpen(false)
          toast({
            title: "Succès",
            description: "Certificat créé avec succès",
            variant: "default",
          })
        } else {
          console.error("[v0] Failed to create certificate:", response)
          toast({
            title: "Erreur",
            description: "Impossible de créer le certificat",
            variant: "destructive",
          })
        }
      } catch (err) {
        console.error("[v0] Error creating certificate:", err)
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de la création du certificat",
          variant: "destructive",
        })
      }
    },
    [patientId, toast],
  )

  const handleDeleteCertificate = useCallback(
    async (certificateId: number) => {
      try {
        const response = await apiClient.deleteCertificate(certificateId)

        if (response.success) {
          // Update local state
          setPatient((prev: any) => ({
            ...prev,
            certificates:
              prev.certificates?.filter((c: any) => c.ID_CM !== certificateId && c.id !== certificateId) || [],
          }))
          toast({
            title: "Succès",
            description: "Certificat supprimé avec succès",
            variant: "default",
          })
        } else {
          console.error("[v0] Failed to delete certificate:", response)
          toast({
            title: "Erreur",
            description: "Impossible de supprimer le certificat",
            variant: "destructive",
          })
        }
      } catch (err) {
        console.error("[v0] Error deleting certificate:", err)
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de la suppression du certificat",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const handlePriceChange = useCallback(
    (appointmentId: number, newPrice: number) => {
      // Update local state immediately for UI feedback
      setPatient((prev: any) => ({
        ...prev,
        appointmentsHistory:
          prev.appointmentsHistory?.map((app: any) =>
            app.ID_RV === appointmentId ? { ...app, payement: newPrice } : app,
          ) || [],
      }))

      // Clear existing timer for this appointment
      if (priceDebounceTimers.current[appointmentId]) {
        clearTimeout(priceDebounceTimers.current[appointmentId])
      }

      // Set new timer to save after 1 second of no typing
      priceDebounceTimers.current[appointmentId] = setTimeout(async () => {
        try {
          setSavingAppointmentId(appointmentId)
          const response = await apiClient.updatePrice(appointmentId, newPrice)

          if (response.success) {
            toast({
              title: "Enregistré",
              description: "Le coût a été mis à jour avec succès",
              variant: "default",
            })
          } else {
            toast({
              title: "Erreur",
              description: "Impossible de sauvegarder le coût",
              variant: "destructive",
            })
          }
        } catch (err) {
          console.error("[v0] Error updating price:", err)
          toast({
            title: "Erreur",
            description: "Une erreur s'est produite lors de la sauvegarde",
            variant: "destructive",
          })
        } finally {
          setSavingAppointmentId(null)
          delete priceDebounceTimers.current[appointmentId]
        }
      }, 1000) // Wait 1 second after user stops typing
    },
    [toast],
  )

  const handleCreditChange = useCallback(
    (appointmentId: number, newCredit: number) => {
      // Update local state immediately for UI feedback
      setPatient((prev: any) => ({
        ...prev,
        appointmentsHistory:
          prev.appointmentsHistory?.map((app: any) =>
            app.ID_RV === appointmentId ? { ...app, credit: newCredit } : app,
          ) || [],
      }))

      // Clear existing timer for this appointment
      if (creditDebounceTimers.current[appointmentId]) {
        clearTimeout(creditDebounceTimers.current[appointmentId])
      }

      // Set new timer to save after 1 second of no typing
      creditDebounceTimers.current[appointmentId] = setTimeout(async () => {
        try {
          setSavingCreditId(appointmentId)
          const response = await apiClient.updateCredit(appointmentId, newCredit)

          if (response.success) {
            toast({
              title: "Enregistré",
              description: "Le reste (crédit) a été mis à jour avec succès",
              variant: "default",
            })
          } else {
            toast({
              title: "Erreur",
              description: "Impossible de sauvegarder le crédit",
              variant: "destructive",
            })
          }
        } catch (err) {
          console.error("[v0] Error updating credit:", err)
          toast({
            title: "Erreur",
            description: "Une erreur s'est produite lors de la sauvegarde du crédit",
            variant: "destructive",
          })
        } finally {
          setSavingCreditId(null)
          delete creditDebounceTimers.current[appointmentId]
        }
      }, 1000) // Wait 1 second after user stops typing
    },
    [toast],
  )

  useEffect(() => {
    return () => {
      Object.values(priceDebounceTimers.current).forEach(clearTimeout)
      Object.values(creditDebounceTimers.current).forEach(clearTimeout)
    }
  }, [])

  const handleUpdatePrice = useCallback(
    async (appointmentId: number, newPrice: number) => {
      setPatient((prev: any) => ({
        ...prev,
        appointmentsHistory:
          prev.appointmentsHistory?.map((app: any) =>
            app.ID_RV === appointmentId ? { ...app, payement: newPrice } : app,
          ) || [],
      }))

      try {
        setSavingAppointmentId(appointmentId)
        const response = await apiClient.updatePrice(appointmentId, newPrice)

        if (response.success) {
          toast({
            title: "Enregistré",
            description: "Le coût a été mis à jour avec succès",
            variant: "default",
          })
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de sauvegarder le coût",
            variant: "destructive",
          })
        }
      } catch (err) {
        console.error("[v0] Error updating price:", err)
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de la sauvegarde",
          variant: "destructive",
        })
      } finally {
        setSavingAppointmentId(null)
      }
    },
    [toast],
  )

  const handleToggleMutuelle = useCallback(
    async (appointmentId: number) => {
      const currentMutuelle = patient?.appointmentsHistory?.find((app: any) => app.ID_RV === appointmentId)?.mutuelle
      const newMutuelle = !currentMutuelle

      setPatient((prev: any) => ({
        ...prev,
        appointmentsHistory:
          prev.appointmentsHistory?.map((app: any) =>
            app.ID_RV === appointmentId ? { ...app, mutuelle: newMutuelle } : app,
          ) || [],
      }))

      try {
        setSavingMutuelleId(appointmentId)
        const response = await apiClient.toggleMutuelle(appointmentId)

        if (response.success) {
          toast({
            title: "Enregistré",
            description: "Le statut mutuelle a été mis à jour avec succès",
            variant: "default",
          })
        } else {
          // Revert on error
          setPatient((prev: any) => ({
            ...prev,
            appointmentsHistory:
              prev.appointmentsHistory?.map((app: any) =>
                app.ID_RV === appointmentId ? { ...app, mutuelle: currentMutuelle } : app,
              ) || [],
          }))
          toast({
            title: "Erreur",
            description: "Impossible de sauvegarder le statut mutuelle",
            variant: "destructive",
          })
        }
      } catch (err) {
        console.error("[v0] Error toggling mutuelle:", err)
        // Revert on error
        setPatient((prev: any) => ({
          ...prev,
          appointmentsHistory:
            prev.appointmentsHistory?.map((app: any) =>
              app.ID_RV === appointmentId ? { ...app, mutuelle: currentMutuelle } : app,
            ) || [],
        }))
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de la sauvegarde",
          variant: "destructive",
        })
      } finally {
        setSavingMutuelleId(null)
      }
    },
    [patient, toast],
  )

  // Fallback act list + prices, matching the appointments page defaults, so a
  // facture can resolve prices even when settings have no custom list.
  const DEFAULT_ACT_PRICES: Record<string, number> = {
    "Consultation": 250,
    "Contrôle": 0,
  }

  // Fetch + normalize settings once, caching in docSettings. Parses
  // facture_layout / medical_acts and proxy-rewrites facture_background.
  const ensureDocSettings = useCallback(async () => {
    if (docSettings) return docSettings
    const res = await apiClient.getUserSettings()
    const raw = (res as any).data?.data ?? (res as any).data ?? {}
    const parsed: any = { ...raw }

    if (typeof parsed.facture_layout === "string") {
      try { parsed.facture_layout = JSON.parse(parsed.facture_layout) } catch { parsed.facture_layout = null }
    }
    if (typeof parsed.certificate_layout === "string") {
      try { parsed.certificate_layout = JSON.parse(parsed.certificate_layout) } catch { parsed.certificate_layout = null }
    }
    if (typeof parsed.medical_acts === "string") {
      try { parsed.medical_acts = JSON.parse(parsed.medical_acts) } catch { parsed.medical_acts = [] }
    }
    if (!Array.isArray(parsed.medical_acts)) parsed.medical_acts = []

    parsed.facture_background = resolveDocumentBackgroundUrl(parsed.facture_background)
    parsed.certificate_background = resolveDocumentBackgroundUrl(parsed.certificate_background)

    setDocSettings(parsed)
    return parsed
  }, [docSettings])

  // Resolve act names → {name, price} using the settings list then defaults.
  const resolveActPrices = (actNames: string[], settingsActs: any[]): { name: string; price: number }[] => {
    return (actNames || []).map((name) => {
      const fromSettings = (settingsActs || []).find((a) => a.name === name)
      const price = fromSettings ? Number(fromSettings.price) : (DEFAULT_ACT_PRICES[name] ?? 0)
      return { name, price }
    })
  }

  const handleOpenFacture = useCallback(async (appointment: any) => {
    try {
      await ensureDocSettings()
      setFactureAppointment(appointment)
      setFactureOpen(true)
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les paramètres de facture", variant: "destructive" })
    }
  }, [ensureDocSettings, toast])

  const handlePrintCertificate = useCallback(
    async (certificateId: number) => {
      try {
        const response = await apiClient.getCertificate(certificateId)

        if (response.success && response.data?.certificate) {
          const certificate = response.data.certificate
          const patientName = patient?.first_name && patient?.last_name
            ? formatName(patient.first_name, patient.last_name)
            : "Patient"

          const startDateStr = String(certificate.start_date || "").trim()
          const endDateStr = String(certificate.end_date || "").trim()

          if (!startDateStr || !endDateStr) {
            console.error("[v0] Certificate dates are missing or invalid:", { startDateStr, endDateStr })
            alert("Erreur: Les dates du certificat sont manquantes")
            return
          }

          try {
            const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number)
            const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number)

            if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
              throw new Error("Invalid date components")
            }

            const startDate = new Date(startYear, startMonth - 1, startDay)
            const endDate = new Date(endYear, endMonth - 1, endDay)

            const restDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

            const startDateFormatted = startDate.toLocaleDateString("fr-FR")
            const endDateFormatted = endDate.toLocaleDateString("fr-FR")
            const today = new Date().toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

            // Load settings (doctor identity, custom template, layout, background).
            const settings = await ensureDocSettings().catch(() => ({} as any))
            const docteur = settings?.practice_name || user?.name || "Docteur"
            const ville = settings?.practice_city || "Oujda"

            // Prefer the certificate's own saved content; otherwise render the
            // settings template (falls back to the default template inside).
            const bodyText = (certificate.content || "").trim()
              ? certificate.content.trim()
              : renderCertificateTemplate(settings?.certificate_template, {
                  patient: patientName,
                  cin: patient?.CIN || patient?.guardian_cin || "[Numéro CIN]",
                  jours: String(restDays),
                  date_debut: startDateFormatted,
                  date_fin: endDateFormatted,
                  docteur,
                  ville,
                  date: today,
                })

            // Open the layout-based preview (positions + background from settings).
            setCertificateBody(bodyText)
            setCertificatePreviewOpen(true)
          } catch (error) {
            console.error("[v0] Date parsing error:", error, { startDateStr, endDateStr })
            alert("Erreur: Impossible de parser les dates du certificat")
            return
          }
        } else {
          console.error("[v0] Failed to fetch certificate:", response)
          toast({
            title: "Erreur",
            description: "Impossible de charger le certificat",
            variant: "destructive",
          })
        }
      } catch (err) {
        console.error("[v0] Error printing certificate:", err)
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de l'impression du certificat",
          variant: "destructive",
        })
      }
    },
    [toast, patient, ensureDocSettings, user],
  )

  const handleAddControl = useCallback(async () => {
    if (!controlDate) return
    setSubmittingControl(true)
    try {
      const response = await apiClient.addControlAppointment(patientId, controlDate)
      const backendData = (response as any).data
      const succeeded = backendData?.success ?? response.success

      if (succeeded) {
        const [y, m, d] = controlDate.split("-")
        const formatted = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("fr-FR", {
          day: "numeric", month: "long", year: "numeric",
        })
        toast({ title: "Contrôle planifié", description: `Rendez-vous de contrôle ajouté pour le ${formatted}` })
        setIsControlModalOpen(false)
        setPatient((prev) => prev ? { ...prev, nextAppointment: { appointment_date: controlDate } } : prev)
      } else {
        const msg = backendData?.message || response.message || "Impossible d'ajouter le contrôle"
        toast({ title: "Erreur", description: msg, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Une erreur s'est produite", variant: "destructive" })
    } finally {
      setSubmittingControl(false)
    }
  }, [patientId, controlDate, toast])

  const handlePrintLastMedicaments = useCallback(async () => {
    try {
      setLoadingMedicaments(true)

      const [medResponse, settingsResponse] = await Promise.all([
        apiClient.getLastMedicamentsByPatient(patientId),
        apiClient.getUserSettings(),
      ])

      // Extract medications (handle both direct and nested response)
      const medData = (medResponse as any).data
      const rawMeds = medData?.medicaments ?? []
      if (!rawMeds.length) {
        toast({ title: "Aucun médicament", description: "Aucune ordonnance trouvée pour ce patient" })
        return
      }
      const appointmentDate: string = medData?.date ?? ""

      // Build medication list in the same pivot format used by the appointments page
      const medications: Array<{ name: string; pivot: { dosage: string; frequence: string; duree: string } }> =
        rawMeds.map((m: any) => ({
          name: m.name || "Médicament",
          pivot: { dosage: m.dosage || "", frequence: m.frequence || "", duree: m.duree || "" },
        }))

      // Load ordonnance settings — same as appointments page
      const settingsData = (settingsResponse as any).data?.data ?? (settingsResponse as any).data ?? {}
      const background: string | null = resolveDocumentBackgroundUrl(settingsData.ordonnance_background)
      const layout: any = typeof settingsData.ordonnance_layout === "string"
        ? JSON.parse(settingsData.ordonnance_layout)
        : settingsData.ordonnance_layout || null

      const patientName = patient?.first_name && patient?.last_name
        ? formatName(patient.first_name, patient.last_name)
        : "Patient"

      const dateStr = new Date(appointmentDate || Date.now()).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      })

      // — Exact same helpers as appointments/[id]/page.tsx —
      const parseMedDoses = (frequence: string) => {
        if (!frequence) return []
        return frequence.split(',').map(part => {
          const colonIdx = part.indexOf(':')
          if (colonIdx < 0) return { time: part.trim(), mealTiming: '' }
          return { time: part.slice(0, colonIdx).trim(), mealTiming: part.slice(colonIdx + 1).trim() }
        }).filter(d => d.time)
      }

      const getMedicationHTML = (med: { name: string; pivot: { dosage: string; frequence: string; duree: string } }) => {
        const doses = parseMedDoses(med.pivot?.frequence || '')
        const duration = med.pivot?.duree || ''
        const name = med.name || 'Médicament'
        let content = ''
        if (doses.length > 0) {
          const count = doses.length
          const timesStr = doses.map(d => d.time.toLowerCase()).join(' et ')
          const mealTimings = [...new Set(doses.map(d => d.mealTiming).filter(Boolean))]
          const mealTimingStr = mealTimings[0] || ''
          let doseLine = `1 cp * ${count}/j ${timesStr}`
          if (mealTimingStr) {
            doseLine += ` ,<span style="display:inline-block;width:50px;"></span>${mealTimingStr}`
          }
          content += `<div style="padding-left:30px;line-height:1.9;">${doseLine}</div>`
        }
        if (duration) {
          content += `<div style="padding-left:30px;line-height:1.9;color:#444;">pendant ${duration}</div>`
        }
        return `<div style="margin-bottom:16px;"><div style="font-weight:bold;margin-bottom:1px;">${name} :</div>${content}</div>`
      }

      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast({ title: "Erreur", description: "Impossible d'ouvrir la fenêtre d'impression", variant: "destructive" })
        return
      }

      let ordonnanceHTML = ""

      if (layout) {
        // CUSTOM LAYOUT — identical to appointments page
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
    <div class="element" style="left: ${elements.patient_name?.x}%; top: ${elements.patient_name?.y}%; font-size: ${((elements.patient_name?.fontSize ?? 18) * paper.width / 600).toFixed(2)}mm; white-space: nowrap;">
      ${patientName}
    </div>
    <div class="element" style="left: ${elements.date?.x}%; top: ${elements.date?.y}%; font-size: ${((elements.date?.fontSize ?? 16) * paper.width / 600).toFixed(2)}mm; white-space: nowrap;">
      ${dateStr}
    </div>
    <div class="element meds-container" style="left: ${elements.medications?.x}%; top: ${elements.medications?.y}%; font-size: ${((elements.medications?.fontSize ?? 16) * paper.width / 600).toFixed(2)}mm; line-height: 1.5; width: ${100 - (elements.medications?.x || 0) - 5}%">
       ${medications.map(m => getMedicationHTML(m)).join('')}
    </div>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => { window.print(); }, 500);
    };
  </script>
</body>
</html>`
      } else {
        // FALLBACK simple list — identical to appointments page fallback
        ordonnanceHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Ordonnance - ${patientName}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 2cm; }
      .header { text-align: right; margin-bottom: 1cm; font-size: 0.95rem; color: #555; }
      .patient-info { margin-bottom: 1cm; font-size: 1.1rem; font-weight: bold; }
      .meds-title { font-weight: bold; text-decoration: underline; margin-bottom: 0.5cm; }
      .medication-list { display: flex; flex-direction: column; gap: 12px; }
      .med-item { line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="header">${dateStr}</div>
    <div class="patient-info">${patientName}</div>
    <div class="meds-title">Ordonnance</div>
    <div class="medication-list">
      ${medications.map(m => getMedicationHTML(m)).join('')}
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
  </body>
</html>`
      }

      printWindow.document.write(ordonnanceHTML)
      printWindow.document.close()
      setTimeout(() => { printWindow.print() }, 250)
    } catch (err) {
      console.error("[v0] Error printing ordonnance:", err)
      toast({ title: "Erreur", description: "Une erreur s'est produite lors de l'impression", variant: "destructive" })
    } finally {
      setLoadingMedicaments(false)
    }
  }, [patientId, toast, patient])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const response = await apiClient.uploadPatientDocument(patientId, file)
      if (response.success && response.data) {
        setDocuments((prev) => [response.data as PatientDocument, ...(Array.isArray(prev) ? prev : [])])
        toast({
          title: "Succès",
          description: "Document téléchargé avec succès",
        })
      }
    } catch (err) {
      console.error("[v0] Error uploading document:", err)
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur lors du téléchargement",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteDocument = async (documentId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return

    try {
      const response = await apiClient.deletePatientDocument(patientId, documentId)
      if (response.success) {
        setDocuments((prev) => (Array.isArray(prev) ? prev.filter((doc) => doc.id !== documentId) : []))
        toast({
          title: "Succès",
          description: "Document supprimé avec succès",
        })
      }
    } catch (err) {
      console.error("[v0] Error deleting document:", err)
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document",
        variant: "destructive",
      })
    }
  }

  const handleDownloadDocument = async (documentId: number) => {
    apiClient.downloadPatientDocument(patientId, documentId)
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Chargement...</h3>
          <p className="text-gray-600">Récupération des détails du patient</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Erreur</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.push("/patients")} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux patients
          </Button>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Patient non trouvé</h3>
          <p className="text-gray-600 mb-4">Le patient demandé n'existe pas.</p>
          <Button onClick={() => router.push("/patients")} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux patients
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Patient Header Section */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/patients")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux patients
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar
                  className="w-16 h-16 border-4 border-white shadow-md cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setIsAvatarZoomed(true)}
                >
                  <AvatarImage
                    src={
                      patient.photo_base64
                        ? `data:image/jpeg;base64,${patient.photo_base64}`
                        : patient.gender === "Female"
                          ? "/placeholder.svg?height=64&width=64&query=female-avatar"
                          : "/placeholder.svg?height=64&width=64&query=male-avatar"
                    }
                  />
                  <AvatarFallback
                    className={patient.gender === "Female" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}
                  >
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center">
                  <Check className="text-white text-xs" />
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {formatName(patient.first_name, patient.last_name)}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-gray-600">
                    {patient.gender === "Female" ? "Femme" : "Homme"}, {calculateAge(patient.birth_day)}
                  </span>
                  {patient.mutuelle && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <Shield className="h-3 w-3 mr-1" />
                      {patient.mutuelle}
                    </Badge>
                  )}
                  {patient.blood_type && (
                    <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                      <Heart className="h-3 w-3 mr-1 fill-current" />
                      {patient.blood_type}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 border-blue-500 text-blue-500 hover:bg-blue-50"
              >
                <Edit className="h-4 w-4" />
                Modifier
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Information Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-blue-500" />
                Informations du Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</p>
                    <p className="text-sm font-medium text-gray-800 flex items-center mt-1">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      {patient.phone_num}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-medium text-gray-800 flex items-center mt-1">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      {patient.email || "Non renseigné"}
                    </p>
                  </div>
                  <div>
                    {patient.guardian_cin && !patient.CIN ? (
                      <>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          CIN {patient.guardian_relation === "mother" ? "de la mère" : "du père"}
                        </p>
                        <p className="text-sm font-medium text-gray-800">{patient.guardian_cin}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</p>
                        <p className="text-sm font-medium text-gray-800">{patient.CIN || "Non renseigné"}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Allergies</p>
                    <div className="text-sm font-medium text-gray-800">
                      {patient.allergies ? (
                        <Badge variant="destructive" className="bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {patient.allergies}
                        </Badge>
                      ) : (
                        "Aucune"
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Maladies chroniques</p>
                  <div className="text-sm font-medium text-gray-800">
                    {patient.chronic_conditions ? (
                      <Badge variant="destructive" className="bg-red-100 text-red-800">
                        <Heart className="h-3 w-3 mr-1" />
                        {patient.chronic_conditions}
                      </Badge>
                    ) : (
                      "Aucune"
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Groupe Sanguin</p>
                  <p className="text-sm font-medium text-gray-800 flex items-center mt-1">
                    <span className="font-bold text-red-600">{patient.blood_type || "N/A"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</p>
                  <p className="text-sm font-medium text-gray-800">{patient.notes || "Aucune note"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Appointment Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                <CalendarCheck className="h-5 w-5 text-blue-500" />
                Dernière Consultation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {patient.lastAppointment ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</p>
                    <p className="text-sm font-medium text-gray-800 flex items-center mt-1">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      {formatDate(patient.lastAppointment.appointment_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</p>
                    <div className="text-sm font-medium text-gray-800 mt-1">
                      {patient.lastAppointment.type ? (
                        <Badge className="bg-blue-100 text-blue-800">{patient.lastAppointment.type}</Badge>
                      ) : (
                        "Non renseigné"
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Diagnostic</p>
                    <div className="text-sm font-medium text-gray-800 mt-1">
                      {patient.lastAppointment.diagnostic ? (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                          {patient.lastAppointment.diagnostic}
                        </Badge>
                      ) : (
                        "Non renseigné"
                      )}
                    </div>
                  </div>
                  {patient.nextAppointment && (
                    <div className="col-span-full mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Prochain Rendez-vous
                      </p>
                      <p className="text-sm font-medium text-green-800 flex items-center">
                        <Calendar className="h-4 w-4 text-green-500 mr-2" />
                        {formatDate(patient.nextAppointment.appointment_date)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucune consultation enregistrée</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visit History Section */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-green-50 border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg text-green-800 mb-3 md:mb-0">
                  <History className="h-5 w-5 text-green-600" />
                  Historique des Visites
                </CardTitle>
                <div className="w-full md:w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Rechercher par date..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-green-300 focus:ring-green-100"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coût
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mutuelle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reste
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Facture
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAppointments.map((appointment: any) => (
                      <tr
                        key={appointment.ID_RV}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/appointments/${appointment.ID_RV}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(appointment.appointment_date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {appointment.type && <Badge className="bg-blue-100 text-blue-800">{appointment.type}</Badge>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={appointment.payement || ""}
                              onChange={(e) => {
                                e.stopPropagation()
                                const newPrice = Number.parseFloat(e.target.value) || 0
                                handlePriceChange(appointment.ID_RV, newPrice)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-24 text-right"
                              placeholder="0"
                              disabled={savingAppointmentId === appointment.ID_RV}
                            />
                            <span className="text-sm text-gray-500">DH</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <label
                            className="relative inline-flex items-center cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={appointment.mutuelle || false}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleToggleMutuelle(appointment.ID_RV)
                              }}
                              disabled={savingMutuelleId === appointment.ID_RV}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                          </label>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={appointment.credit !== undefined && appointment.credit !== null ? appointment.credit : ""}
                              onChange={(e) => {
                                e.stopPropagation()
                                const newCredit = Number.parseFloat(e.target.value) || 0
                                handleCreditChange(appointment.ID_RV, newCredit)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-24 text-right ${(appointment.credit || 0) > 0 ? "text-red-600 font-bold border-red-300 focus:ring-red-100" : ""}`}
                              placeholder="0"
                              disabled={savingCreditId === appointment.ID_RV}
                            />
                            <span className="text-sm text-gray-500">DH</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                            title={
                              (!appointment.medical_acts || appointment.medical_acts.length === 0) && !appointment.payement
                                ? "Aucun acte ou montant pour ce rendez-vous"
                                : "Imprimer la facture"
                            }
                            disabled={(!appointment.medical_acts || appointment.medical_acts.length === 0) && !appointment.payement}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenFacture(appointment)
                            }}
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-purple-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
                <Zap className="h-5 w-5 text-purple-500" />
                Actions Rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Button
                onClick={() => setConfirmControlOpen(true)}
                className="w-full flex items-center justify-between bg-blue-50 text-blue-600 hover:bg-blue-100 border-0"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter Contrôle
                </span>
                <span>→</span>
              </Button>
              <Button
                onClick={() => { ensureDocSettings().catch(() => {}); setIsCertificateModalOpen(true) }}
                className="w-full flex items-center justify-between bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-0"
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Certificat Médical
                </span>
                <span>→</span>
              </Button>
              <Button
                onClick={handlePrintLastMedicaments}
                disabled={loadingMedicaments}
                className="w-full flex items-center justify-between bg-green-50 text-green-600 hover:bg-green-100 border-0 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  {loadingMedicaments ? "Chargement..." : "Imprimer Médicaments"}
                </span>
                <span>→</span>
              </Button>
            </CardContent>
          </Card>

          {/* Medical Certificates Section */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-indigo-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-800">
                <FileCheck className="h-5 w-5 text-indigo-500" />
                Certificats Médicaux
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {patient.certificates && patient.certificates.length > 0 ? (
                  patient.certificates.map((certificate: any) => (
                    <div key={certificate.ID_CM} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-800">
                            {formatDate(certificate.start_date)} → {formatDate(certificate.end_date)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {Math.ceil(
                              (new Date(certificate.end_date).getTime() - new Date(certificate.start_date).getTime()) /
                              (1000 * 60 * 60 * 24),
                            )}{" "}
                            jours
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200"
                            onClick={() => {
                              handlePrintCertificate(certificate.ID_CM)
                            }}
                          >
                            <Printer className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCertificate(certificate.ID_CM)}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {certificate.content ? (
                          certificate.content.length > 80 ? (
                            `${certificate.content.substring(0, 80)}...`
                          ) : (
                            certificate.content
                          )
                        ) : (
                          <span className="text-gray-400 italic">Aucun contenu</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>Aucun certificat enregistré</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Patient Documents Section */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-amber-50 border-b flex flex-row items-center justify-between py-3">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <FileUp className="h-5 w-5 text-amber-500" />
                Documents du Patient
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="bg-white border-amber-200 text-amber-600 hover:bg-amber-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Ajouter
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {documents && documents.length > 0 ? (
                  documents.map((doc: PatientDocument) => (
                    <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors group">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <FileText className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-medium text-gray-800 truncate text-sm" title={doc.document_name}>
                              {doc.document_name}
                            </p>
                            <p className="text-[10px] text-gray-500 flex items-center gap-2">
                              <span>{new Date(doc.uploaded_at).toLocaleDateString("fr-FR")}</span>
                              <span>•</span>
                              <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="p-2 h-8 w-8 text-blue-600 hover:bg-blue-100"
                            onClick={() => handleDownloadDocument(doc.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 h-8 w-8 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <FileUp className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm italic">Aucun document téléchargé</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Patient Stats Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-cyan-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-cyan-800">
                <BarChart3 className="h-5 w-5 text-cyan-500" />
                Statistiques
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Consultations</p>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <CalendarCheck className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-xl font-bold text-gray-800">{patient.appointmentsHistory?.length || 0}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Dernière Visite</p>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <Clock className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-800">
                    {patient.lastAppointment
                      ? new Date(patient.lastAppointment.appointment_date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                      })
                      : "Jamais"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Certificats Médicaux</p>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <FileCheck className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-800">
                    {patient.certificates?.length || 0} certificat(s)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Patient Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le Patient</DialogTitle>
          </DialogHeader>
          <PatientForm initialData={patient} onSubmit={handleEditPatient} isEdit={true} />
        </DialogContent>
      </Dialog>

      {/* Certificate Modal */}
      <Dialog open={isCertificateModalOpen} onOpenChange={setIsCertificateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Certificat Médical</DialogTitle>
          </DialogHeader>
          <CertificateForm
            onSubmit={handleAddCertificate}
            onCancel={() => setIsCertificateModalOpen(false)}
            buildContent={(jours, start, end) => {
              const patientName = patient?.first_name && patient?.last_name
                ? formatName(patient.first_name, patient.last_name)
                : "Patient"
              const fmt = (d: string) => {
                const date = new Date(d)
                return isNaN(date.getTime()) ? d : date.toLocaleDateString("fr-FR")
              }
              return renderCertificateTemplate(docSettings?.certificate_template, {
                patient: patientName,
                cin: patient?.CIN || patient?.guardian_cin || "[Numéro CIN]",
                jours: String(jours),
                date_debut: fmt(start),
                date_fin: fmt(end),
                docteur: docSettings?.practice_name || user?.name || "Docteur",
                ville: docSettings?.practice_city || "Oujda",
                date: new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
              })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Plan Control Appointment */}
      <PlanControlModal
        open={confirmControlOpen}
        onOpenChange={setConfirmControlOpen}
        patientId={patientId}
        patientName={patient ? formatName(patient.first_name, patient.last_name) : ""}
        onResult={handleControlResult}
      />

      {/* Facture print preview (from a history row) */}
      <FacturePrintPreview
        open={factureOpen}
        onOpenChange={setFactureOpen}
        layout={docSettings?.facture_layout || null}
        background={docSettings?.facture_background || null}
        patientName={patient ? formatName(patient.first_name, patient.last_name) : "Patient"}
        dateStr={factureAppointment ? formatDate(factureAppointment.appointment_date) : ""}
        acts={resolveActPrices(factureAppointment?.medical_acts || [], docSettings?.medical_acts || [])}
        total={factureAppointment?.payement ?? 0}
        credit={factureAppointment?.credit ?? 0}
        mutuelle={!!factureAppointment?.mutuelle}
        header={{
          practiceName: docSettings?.practice_name,
          specialization: docSettings?.specialization,
          address: docSettings?.address,
          phone: docSettings?.phone,
          city: docSettings?.practice_city,
        }}
      />

      {/* Certificate print preview (layout + background from settings) */}
      <CertificatePrintPreview
        open={certificatePreviewOpen}
        onOpenChange={setCertificatePreviewOpen}
        layout={docSettings?.certificate_layout || null}
        background={docSettings?.certificate_background || null}
        body={certificateBody}
      />

      {/* Avatar Zoom Modal */}
      {
        isAvatarZoomed && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300"
            onClick={() => setIsAvatarZoomed(false)}
          >
            <Avatar className="w-32 h-32 md:w-48 md:h-48 border-4 border-white shadow-2xl">
              <AvatarImage
                src={
                  patient.photo_base64
                    ? `data:image/jpeg;base64,${patient.photo_base64}`
                    : patient.gender === "Female"
                      ? "/placeholder.svg?height=192&width=192&query=female-avatar"
                      : "/placeholder.svg?height=192&width=192&query=male-avatar"
                }
              />
              <AvatarFallback
                className={patient.gender === "Female" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"}
              >
                <User className="h-24 w-24" />
              </AvatarFallback>
            </Avatar>
          </div>
        )
      }
    </div >
  )
}

// Patient Form Component
function PatientForm({
  initialData,
  onSubmit,
  isEdit = false,
}: {
  initialData?: any
  onSubmit: (data: any) => void
  isEdit?: boolean
}) {
  const [formData, setFormData] = useState({
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    gender: initialData?.gender || "Male",
    birth_day: initialData?.birth_day || "",
    CIN: initialData?.CIN || "",
    guardian_cin: initialData?.guardian_cin || "",
    guardian_relation: initialData?.guardian_relation || "father",
    phone_num: initialData?.phone_num || "",
    email: initialData?.email || "",
    mutuelle: initialData?.mutuelle || "none",
    allergies: initialData?.allergies || "",
    chronic_conditions: initialData?.chronic_conditions || "",
    notes: initialData?.notes || "",
    blood_type: initialData?.blood_type || "",
  })

  const patientIsMinor = isMinor(formData.birth_day)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitData = {
      ...formData,
      mutuelle: formData.mutuelle === "none" ? "" : formData.mutuelle,
    }
    onSubmit(submitData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">Prénom</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="last_name">Nom de famille</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="gender">Sexe</Label>
          <Select value={formData.gender} onValueChange={(value) => handleChange("gender", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Homme</SelectItem>
              <SelectItem value="Female">Femme</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="birth_day">Date de naissance</Label>
          <Input
            id="birth_day"
            type="date"
            value={formData.birth_day}
            onChange={(e) => handleChange("birth_day", e.target.value)}
            required
          />
        </div>

        {patientIsMinor ? (
          <>
            <div>
              <Label htmlFor="guardian_cin">CIN du parent/tuteur</Label>
              <Input
                id="guardian_cin"
                placeholder="CIN du père ou de la mère"
                value={formData.guardian_cin}
                onChange={(e) => handleChange("guardian_cin", e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="guardian_relation">Lien de parenté</Label>
              <Select
                value={formData.guardian_relation}
                onValueChange={(value) => handleChange("guardian_relation", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="father">Père</SelectItem>
                  <SelectItem value="mother">Mère</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div>
            <Label htmlFor="CIN">CIN</Label>
            <Input id="CIN" value={formData.CIN} onChange={(e) => handleChange("CIN", e.target.value)} required />
          </div>
        )}

        <div>
          <Label htmlFor="phone_num">Téléphone</Label>
          <Input
            id="phone_num"
            type="tel"
            value={formData.phone_num}
            onChange={(e) => handleChange("phone_num", e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="mutuelle">Mutuelle</Label>
          <Select value={formData.mutuelle} onValueChange={(value) => handleChange("mutuelle", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              <SelectItem value="CNSS">CNSS</SelectItem>
              <SelectItem value="CNOPS">CNOPS</SelectItem>
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="allergies">Allergies</Label>
          <Textarea
            id="allergies"
            value={formData.allergies}
            onChange={(e) => handleChange("allergies", e.target.value)}
            rows={2}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="chronic_conditions">Maladies chroniques</Label>
          <Textarea
            id="chronic_conditions"
            value={formData.chronic_conditions}
            onChange={(e) => handleChange("chronic_conditions", e.target.value)}
            rows={2}
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Label htmlFor="blood_type">Groupe Sanguin</Label>
          <Select value={formData.blood_type} onValueChange={(value) => handleChange("blood_type", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline">
          Annuler
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          <Save className="h-4 w-4 mr-2" />
          {isEdit ? "Mettre à jour" : "Enregistrer"}
        </Button>
      </div>
    </form>
  )
}

// Certificate Form Component
function CertificateForm({
  onSubmit,
  onCancel,
  buildContent,
}: {
  onSubmit: (data: any) => void
  onCancel: () => void
  // Renders the settings template for the given rest-day count + dates.
  buildContent: (jours: number, start: string, end: string) => string
}) {
  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const timeDiff = endDate.getTime() - startDate.getTime()
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
  }

  const initialStart = new Date().toISOString().split("T")[0]
  const initialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [formData, setFormData] = useState({
    start_date: initialStart,
    end_date: initialEnd,
    content: buildContent(calculateDays(initialStart, initialEnd), initialStart, initialEnd),
  })
  const [contentTouched, setContentTouched] = useState(false)

  const daysCount = calculateDays(formData.start_date, formData.end_date)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (daysCount > 20) {
      alert("La durée du certificat ne peut pas dépasser 20 jours")
      return
    }
    if (daysCount < 1) {
      alert("La date de fin doit être après la date de début")
      return
    }
    onSubmit(formData)
  }

  const regenerate = (start: string, end: string) => {
    setFormData((prev) => ({ ...prev, content: buildContent(calculateDays(start, end), start, end) }))
    setContentTouched(false)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      // Keep the body in sync with the dates until the doctor edits it manually.
      if ((field === "start_date" || field === "end_date") && !contentTouched) {
        next.content = buildContent(calculateDays(next.start_date, next.end_date), next.start_date, next.end_date)
      }
      return next
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Date de Début</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleChange("start_date", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="end_date">Date de Fin</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => handleChange("end_date", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
        <p className="text-sm font-medium text-blue-900">
          Durée: <span className={daysCount > 20 ? "text-red-600 font-bold" : ""}>{daysCount} jour(s)</span>
          {daysCount > 20 && <span className="text-red-600 ml-2">(Max 20 jours)</span>}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Contenu du Certificat</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500"
            onClick={() => regenerate(formData.start_date, formData.end_date)}
          >
            Régénérer depuis le modèle
          </Button>
        </div>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => {
            setContentTouched(true)
            handleChange("content", e.target.value)
          }}
          rows={8}
          required
          placeholder="Je soussigné(e), Dr. [Nom du médecin], certifie que..."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={daysCount > 20}>
          <Save className="h-4 w-4 mr-2" />
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
