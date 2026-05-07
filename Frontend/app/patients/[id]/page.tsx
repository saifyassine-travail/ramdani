"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Edit, User, Phone, Mail, FileText, AlertCircle, Heart, Calendar, CalendarCheck, History, Search, Zap, FileCheck, BarChart3, Clock, Plus, Save, Trash2, Printer, Shield, Check, Download, Upload, FileUp } from 'lucide-react'
import { apiClient, type PatientDocument } from "@/lib/api"
import { formatGlobalDate } from "@/lib/format-date"

interface PatientDetails {
  ID_patient: number
  first_name: string
  last_name: string
  birth_day: string
  gender: string
  CIN: string
  phone_num: string
  email?: string
  mutuelle?: string
  allergies?: string
  chronic_conditions?: string
  notes?: string
  blood_type?: string
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

  const [patient, setPatient] = useState<PatientDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAvatarZoomed, setIsAvatarZoomed] = useState(false)
  const [savingAppointmentId, setSavingAppointmentId] = useState<number | null>(null)
  const [savingMutuelleId, setSavingMutuelleId] = useState<number | null>(null)
  const [savingCreditId, setSavingCreditId] = useState<number | null>(null)
  const [loadingMedicaments, setLoadingMedicaments] = useState(false)
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)


  const priceDebounceTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const creditDebounceTimers = useRef<Record<number, NodeJS.Timeout>>({})

  useEffect(() => {
    const fetchPatientDetails = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log("[v0] Fetching patient details for ID:", patientId)

        const response = await apiClient.getPatient(patientId)
        console.log("[v0] Patient details response:", response)

        if (response.success && response.data) {
          // Handle both direct patient data and nested structure from your controller
          const patientData = response.data.patient || response.data
          const appointmentsHistory = response.data.appointmentsHistory || []
          const lastAppointment = response.data.lastAppointment
          const nextAppointment = response.data.nextAppointment

          let certificates: any[] = patientData.certificates || []
          console.log("[v0] Certificates from patient data:", certificates)

          // If no certificates in patient data, fetch them separately
          if (certificates.length === 0) {
            console.log("[v0] No certificates in patient data, fetching separately...")
            try {
              const certificatesResponse = await apiClient.getCertificates(patientId)
              console.log("[v0] Certificates API response:", certificatesResponse)
              if (certificatesResponse.success && certificatesResponse.data) {
                certificates = Array.isArray(certificatesResponse.data)
                  ? certificatesResponse.data
                  : (certificatesResponse.data.certificates || [])
                console.log("[v0] Loaded certificates from API:", certificates)
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
            phone_num: patientData.phone_num,
            email: patientData.email,
            mutuelle: patientData.mutuelle,
            allergies: patientData.allergies,
            chronic_conditions: patientData.chronic_conditions,
            notes: patientData.notes,
            blood_type: patientData.blood_type,
            archived: Boolean(patientData.archived),
            lastAppointment: lastAppointment,
            nextAppointment: nextAppointment,
            appointmentsHistory: appointmentsHistory,
            certificates: certificates,
          }

          console.log("[v0] Transformed patient data:", transformedPatient)
          setPatient(transformedPatient)
        } else {
          console.error("[v0] Failed to fetch patient details:", response)
          setError("Failed to load patient details")
        }
      } catch (err) {
        console.error("[v0] Error fetching patient details:", err)
        setError("Network error occurred")
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
        console.log("[v0] Updating patient with data:", formData)
        const response = await apiClient.updatePatient(patientId, formData)

        if (response.success) {
          // Update local state with new data
          setPatient((prev: any) => ({ ...prev, ...formData }))
          setIsEditModalOpen(false)
          console.log("[v0] Patient updated successfully")
        } else {
          console.error("[v0] Failed to update patient:", response)
          setError("Failed to update patient")
        }
      } catch (err) {
        console.error("[v0] Error updating patient:", err)
        setError("Network error occurred while updating patient")
      }
    },
    [patientId],
  )

  const handleAddCertificate = useCallback(
    async (certificateData: any) => {
      try {
        console.log("[v0] Creating certificate with data:", certificateData)
        const certificatePayload = {
          ...certificateData,
          ID_patient: patientId,
        }
        console.log("[v0] Certificate payload being sent:", certificatePayload)
        const response = await apiClient.createCertificate(patientId, certificateData)

        console.log("[v0] Certificate creation response:", response)

        if (response.success) {
          const newCertificate = response.data
          console.log("[v0] New certificate created:", newCertificate)
          setPatient((prev: any) => {
            const updatedCerts = Array.isArray(prev.certificates) ? [...prev.certificates] : []
            if (newCertificate && newCertificate.ID_CM) {
              updatedCerts.push(newCertificate)
            }
            console.log("[v0] Updated certificates array:", updatedCerts)
            return { ...prev, certificates: updatedCerts }
          })

          // Also fetch the complete list to ensure consistency
          const certificatesResponse = await apiClient.getCertificates(patientId)
          console.log("[v0] Fetched certificates after creation:", certificatesResponse)
          if (certificatesResponse.success && certificatesResponse.data) {
            setPatient((prev: any) => ({
              ...prev,
              certificates: certificatesResponse.data,
            }))
          }

          setIsCertificateModalOpen(false)
          toast({
            title: "Succès",
            description: "Certificat créé avec succès",
            variant: "default",
          })
          console.log("[v0] Certificate created successfully")
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
        console.log("[v0] Deleting certificate with ID:", certificateId)
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
          console.log("[v0] Certificate deleted successfully")
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

  const handlePrintCertificate = useCallback(
    async (certificateId: number) => {
      try {
        console.log("[v0] Fetching certificate for printing with ID:", certificateId)
        const response = await apiClient.getCertificate(certificateId)

        console.log("[v0] Certificate fetch response:", response)

        if (response.success && response.data?.certificate) {
          const certificate = response.data.certificate
          const patientName = patient?.first_name && patient?.last_name
            ? `${patient.first_name} ${patient.last_name}`
            : "Patient"

          console.log("[v0] Certificate object:", certificate)
          console.log("[v0] Start date raw:", JSON.stringify(certificate.start_date))
          console.log("[v0] End date raw:", JSON.stringify(certificate.end_date))

          const startDateStr = String(certificate.start_date || "").trim()
          const endDateStr = String(certificate.end_date || "").trim()



          if (!startDateStr || !endDateStr) {
            console.error("[v0] Certificate dates are missing or invalid:", { startDateStr, endDateStr })
            alert("Erreur: Les dates du certificat sont manquantes")
            return
          }

          console.log("[v0] Start date trimmed:", startDateStr)
          console.log("[v0] End date trimmed:", endDateStr)

          try {
            const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number)
            const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number)

            if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
              throw new Error("Invalid date components")
            }

            const startDate = new Date(startYear, startMonth - 1, startDay)
            const endDate = new Date(endYear, endMonth - 1, endDay)

            console.log("[v0] Parsed start date:", startDate)
            console.log("[v0] Parsed end date:", endDate)

            const restDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            console.log("[v0] Calculated rest days:", restDays)

            const printWindow = window.open("", "_blank")
            if (printWindow) {
              const startDateFormatted = startDate.toLocaleDateString("fr-FR")
              const endDateFormatted = endDate.toLocaleDateString("fr-FR")
              const today = new Date().toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

              const content = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="UTF-8">
                    <title>Certificat Médical</title>
                    <style>
                      * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                      }

                      body {
                        font-family: 'Times New Roman', serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        padding: 40px 20px;
                        background: white;
                      }

                      .certificate-content {
                        width: 100%;
                        max-width: 700px;
                        line-height: 1.8;
                        text-align: justify;
                        font-size: 14px;
                        color: #333;
                      }

                      .signature-space {
                        margin-top: 60px;
                        padding-top: 30px;
                        text-align: center;
                      }

                      @media print {
                        body {
                          padding: 0;
                        }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="certificate-content">
                      <p>CERTIFICAT MÉDICAL</p>
                      <p>Je soussignée, Docteur Ouafae ELMEHRAOUI certifie avoir vu et examiné en consultation aujourd'hui:</p>
                      <p><strong>${patientName}</strong></p>
                      <p>portant le CIN: <strong>${patient?.CIN || '[Numéro CIN]'}</strong></p>
                      <p>nécessite un repos de <strong>${restDays} jours</strong></p>
                      <p>et atteste que son état de santé nécessite un arrêt de travail de <strong>${restDays} jours</strong> à compter de ce jour.</p>
                      <p>Certificat délivré en main propre à l'intéressé(e) pour servir et valoir ce que de droit.</p>
                      <p>A Oujda le <strong>${today}</strong></p>
                      
                      <div class="signature-space">
                        <p>Signature et Cachet du Médecin</p>
                      </div>
                    </div>
                  </body>
                </html>
              `
              printWindow.document.write(content)
              printWindow.document.close()

              // Wait for content to render before printing
              printWindow.addEventListener("load", () => {
                setTimeout(() => {
                  printWindow.print()
                }, 300)
              })
            } else {
              toast({
                title: "Erreur",
                description: "Impossible d'ouvrir la fenêtre d'impression",
                variant: "destructive",
              })
            }
            console.log("[v0] Certificate fetched successfully for printing")
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
    [toast, patient],
  )

  const handlePrintLastMedicaments = useCallback(
    async () => {
      try {
        console.log("[v0] Fetching last medicaments for patient:", patientId)
        setLoadingMedicaments(true)

        const response = await apiClient.getLastMedicamentsByPatient(patientId)
        console.log("[v0] Last medicaments response:", response)

        if (response.success && response.data?.medicaments && response.data.medicaments.length > 0) {
          const medicaments = response.data.medicaments
          const patientName = patient?.first_name && patient?.last_name
            ? `${patient.first_name} ${patient.last_name}`
            : "Patient"

          const medicamentsPerPage = 8
          const page1Medicaments = medicaments.slice(0, medicamentsPerPage)
          const page2Medicaments = medicaments.slice(medicamentsPerPage)
          const hasMultiplePages = medicaments.length > medicamentsPerPage

          const printWindow = window.open("", "_blank")
          if (!printWindow) {
            toast({
              title: "Erreur",
              description: "Impossible d'ouvrir la fenêtre d'impression",
              variant: "destructive",
            })
            return
          }

          const generateMedicationList = (meds: typeof medicaments) => {
            return meds.length > 0
              ? meds
                .map(
                  (med) => `
                  <div class="medication-item">• ${med.name || "Médicament"} </div>
                `,
                )
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
      <!-- Page 1 -->
      <div class="page">
        <div class="medication-list">
          ${generateMedicationList(page1Medicaments)}
        </div>
      </div>
      
      <!-- Page 2 (if needed) -->
      ${hasMultiplePages
              ? `
        <div class="page-break"></div>
        <div class="page">
          <div class="medication-list">
            ${generateMedicationList(page2Medicaments)}
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

          // Wait for content to load then print
          setTimeout(() => {
            printWindow.print()
          }, 250)

          console.log("[v0] Last medicaments printed successfully")
        } else {
          toast({
            title: "Aucun médicament",
            description: "Aucun médicament trouvé pour le dernier rendez-vous du patient",
            variant: "default",
          })
        }
      } catch (err) {
        console.error("[v0] Error printing last medicaments:", err)
        toast({
          title: "Erreur",
          description: "Une erreur s'est produite lors de l'impression des médicaments",
          variant: "destructive",
        })
      } finally {
        setLoadingMedicaments(false)
      }
    },
    [patientId, toast, patient],
  )

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
                      patient.gender === "Female"
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
                  {patient.first_name} {patient.last_name}
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
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</p>
                    <p className="text-sm font-medium text-gray-800">{patient.CIN || "Non renseigné"}</p>
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
              <Button className="w-full flex items-center justify-between bg-blue-50 text-blue-600 hover:bg-blue-100 border-0">
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter Contrôle
                </span>
                <span>→</span>
              </Button>
              <Button
                onClick={() => setIsCertificateModalOpen(true)}
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
          />
        </DialogContent>
      </Dialog>

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
                  patient.gender === "Female"
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
    phone_num: initialData?.phone_num || "",
    email: initialData?.email || "",
    mutuelle: initialData?.mutuelle || "none",
    allergies: initialData?.allergies || "",
    chronic_conditions: initialData?.chronic_conditions || "",
    notes: initialData?.notes || "",
    blood_type: initialData?.blood_type || "",
  })

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

        <div>
          <Label htmlFor="CIN">CIN</Label>
          <Input id="CIN" value={formData.CIN} onChange={(e) => handleChange("CIN", e.target.value)} required />
        </div>

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
}: {
  onSubmit: (data: any) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    content: "Je soussigné(e), Dr. [Nom du médecin], certifie que...",
  })

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const timeDiff = endDate.getTime() - startDate.getTime()
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
  }

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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
        <Label htmlFor="content">Contenu du Certificat</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => handleChange("content", e.target.value)}
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
