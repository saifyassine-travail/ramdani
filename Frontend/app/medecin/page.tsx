"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient, type Appointment } from "@/lib/api"
import { formatName } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Clock,
  Calendar,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  User,
  FileText,
  Stethoscope,
  History,
  Phone,
  CreditCard,
  AlertTriangle,
} from "lucide-react"

interface DashboardData {
  totalPatients: number
  todayPatients: number
  activeAppointments: number
  currentPatient: Appointment | null
  waitingPatients: Appointment[]
  preparingPatients: Appointment[]
  completedPatients: Appointment[]
  cancelledPatients: Appointment[]
  upcomingAppointments: Appointment[]
  averageConsultationTime: number
  dailyRevenue: number
  completedRevenue: number
  pendingRevenue: number
  statusCounts: {
    waiting: number
    preparing: number
    consulting: number
    completed: number
    cancelled: number
  }
  patientHistory: Appointment[]
}

const DoctorDashboard = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(() => fetchDashboardData(true), 1000) // Refresh every 1s for near real-time
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async (isBackground = false) => {
    // Keep loading state mostly for initial load, silent refresh for updates
    if (!isBackground && !data) setLoading(true)
    setError(null)
    // Always skip cache when doing background refresh to get real-time data
    const response = await apiClient.getMedecinDashboard(true)

    if (response.success && response.data) {
      const rawData = response.data as any
      const actualData = rawData.data || rawData

      const transformedData: DashboardData = {
        totalPatients: Number(actualData.totalPatients || 0),
        todayPatients: Number(actualData.todayPatients || 0),
        activeAppointments: Number(actualData.activeAppointments || 0),
        currentPatient: actualData.currentPatient || null,
        waitingPatients: actualData.waitingPatients || [],
        preparingPatients: actualData.preparingPatients || [],
        completedPatients: actualData.completedTodayPatients || actualData.completedPatients || [],
        cancelledPatients: actualData.cancelledTodayPatients || actualData.cancelledPatients || [],
        upcomingAppointments: actualData.upcomingAppointments || [],
        averageConsultationTime: Number(actualData.averageConsultationTime || 0),
        dailyRevenue: Number(actualData.dailyRevenue || 0),
        completedRevenue: Number(actualData.completedRevenue || 0),
        pendingRevenue: Number(actualData.pendingRevenue || 0),
        statusCounts: actualData.statusCounts || {
          waiting: actualData.waitingPatients?.length || 0,
          preparing: actualData.preparingPatients?.length || 0,
          consulting: actualData.currentPatient ? 1 : 0,
          completed: actualData.completedTodayPatients?.length || actualData.completedPatients?.length || 0,
          cancelled: actualData.cancelledTodayPatients?.length || actualData.cancelledPatients?.length || 0,
        },
        patientHistory: actualData.patientHistory || [],
      }

      setData(transformedData)
    } else {
      setError(response.message || "Impossible de se connecter au serveur backend")
    }
    setLoading(false)
  }

  const handleNavigatePatient = async (direction: "next" | "previous") => {
    // Optimistic Update
    const previousData = { ...data } as DashboardData

    // Logic to simulate change locally
    let newData = { ...previousData }
    let newCurrent = null

    if (direction === "next") {
      if (newData.waitingPatients.length > 0) {
        newCurrent = { ...newData.waitingPatients[0], status: "En consultation", consultation_started_at: new Date().toISOString() }
        newData.waitingPatients = newData.waitingPatients.slice(1)
        // If there was a current patient, they likely go to completed or back to waiting?
        // "Next" usually implies finishing the current one or just swapping. 
        // The backend logic for "next" seems to just grab the next one.
        // For true optimistic UI, we'd need to know exactly what the backend does.
        // Backend: nextPatient->status = 'En consultation'.
        // It DOES NOT touch the current patient status automatically in the snippet I saw! 
        // (Wait, `navigatePatient` backend logic handles `nextPatient`... but what about the old one?)
        // The backend `navigatePatient` implementation I saw ONLY touches the NEW patient.
        // It does NOT finish the old one. So we might have multiple "En consultation"?
        // Ah, the dashboard logic `currentPatient` queries `latest()`.
        // So the new one becomes the current one.
        newData.currentPatient = newCurrent
        // Add to active count?
        newData.activeAppointments += 1 // Roughly
        newData.statusCounts.consulting = 1
        newData.statusCounts.waiting -= 1
      }
    } else {
      // Previous... similar logic, tricky to guess exactly which one without backend sort.
      // For simplicity/safety, we might just show loading or just rely on the fast backend?
      // Actually, user complained about "long time to response". 
      // Let's at least show a loading state or try to guess.
      // Let's just set loading for previous to be safe, but "next" is common and easy to guess.
    }

    setData(newData)

    const response = await apiClient.navigatePatient(direction)
    if (response.success) {
      // Background refresh to ensure consistency
      fetchDashboardData()
    } else {
      // Revert on failure
      setData(previousData)
      // toast.error("Erreur...")
    }
  }

  const handleCompleteConsultation = async () => {
    if (!data?.currentPatient) return

    // Optimistic
    const previousData = { ...data }
    const completedPatient = { ...data.currentPatient, status: "Terminé" }

    const newData = {
      ...previousData,
      currentPatient: null, // No current patient
      completedPatients: [completedPatient, ...previousData.completedPatients],
      statusCounts: {
        ...previousData.statusCounts,
        consulting: 0,
        completed: previousData.statusCounts.completed + 1
      },
      todayPatients: previousData.todayPatients, // doesn't change
      // Update revenue? Maybe
      dailyRevenue: previousData.dailyRevenue + (completedPatient.payement || 0),
      completedRevenue: previousData.completedRevenue + (completedPatient.payement || 0),
      pendingRevenue: previousData.pendingRevenue - (completedPatient.payement || 0),
    }

    setData(newData)

    const response = await apiClient.updateMedecinStatus(data.currentPatient.ID_RV, "Terminé")
    if (response.success) {
      fetchDashboardData(true) // Silent refresh
    } else {
      setData(previousData)
    }
  }

  const handleCancelConsultation = async () => {
    if (!data?.currentPatient) return

    const previousData = { ...data }
    const cancelledPatient = { ...data.currentPatient, status: "Annulé" }

    const newData = {
      ...previousData,
      currentPatient: null,
      cancelledPatients: [cancelledPatient, ...previousData.cancelledPatients],
      statusCounts: {
        ...previousData.statusCounts,
        consulting: 0,
        cancelled: previousData.statusCounts.cancelled + 1
      }
    }

    setData(newData)

    const response = await apiClient.updateMedecinStatus(data.currentPatient.ID_RV, "Annulé")
    if (response.success) {
      fetchDashboardData(true)
    } else {
      setData(previousData)
    }
  }

  const handleReturnToConsultation = async (appointmentId: number) => {
    // Tricky to optimistic update without knowing which one exactly in the list
    // But we can find it in completedPatients
    const previousData = { ...data } as DashboardData
    const patientToReturn = previousData.completedPatients.find(p => p.ID_RV === appointmentId)

    if (patientToReturn) {
      const newData = {
        ...previousData,
        currentPatient: { ...patientToReturn, status: "En consultation" },
        completedPatients: previousData.completedPatients.filter(p => p.ID_RV !== appointmentId),
        statusCounts: {
          ...previousData.statusCounts,
          consulting: 1,
          completed: previousData.statusCounts.completed - 1
        }
      }
      setData(newData)
    }

    const response = await apiClient.returnToConsultation(appointmentId)
    if (response.success) {
      fetchDashboardData(true)
    } else {
      setData(previousData)
    }
  }

  const handleViewPatient = (patientId: number) => {
    router.push(`/patients/${patientId}`)
  }

  const handleViewAppointment = (appointmentId: number) => {
    router.push(`/appointments/${appointmentId}`)
  }

  // Determine Initials for Avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-6 bg-gray-50">
        <Card className="max-w-md w-full border-red-200 shadow-lg">
          <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
            <CardTitle className="flex items-center text-red-700">
              <AlertCircle className="w-6 h-6 mr-2" />
              Erreur de connexion
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-center text-gray-600">{error}</p>
            <Button onClick={fetchDashboardData} className="w-full" variant="destructive">
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Header Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex flex-row items-center p-4 space-x-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-100 rounded-full">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Patients Aujourd'hui</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.todayPatients}</h3>
          </div>
        </Card>

        <Card className="flex flex-row items-center p-4 space-x-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-green-100 rounded-full">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Recette du Jour</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.dailyRevenue} <span className="text-sm font-normal text-gray-500">DH</span></h3>
          </div>
        </Card>

        <Card className="flex flex-row items-center p-4 space-x-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-orange-100 rounded-full">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Temps Moyen</p>
            <h3 className="text-2xl font-bold text-gray-900">{data.averageConsultationTime} <span className="text-sm font-normal text-gray-500">min</span></h3>
          </div>
        </Card>

        <Card className="items-center justify-between p-4 bg-primary text-primary-foreground shadow-md hidden md:flex">
          <div>
            <p className="text-sm font-medium opacity-90">Salle d'attente</p>
            <h3 className="text-3xl font-bold">{data.waitingPatients.length}</h3>
          </div>
          <Users className="w-10 h-10 opacity-80" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-180px)]">
        {/* Main Focus: Active Consultation (Left Column) */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <Card className="flex-1 border-primary/20 shadow-md relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-blue-400" />

            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
                    <Activity className="w-3 h-3 mr-1 animate-pulse" />
                    Consultation en cours
                  </Badge>
                  <CardTitle className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    {data.currentPatient ? (
                      <>
                        {data.currentPatient.patient.gender === "Female" ? "Mme." : "M."} {formatName(data.currentPatient.patient.first_name, data.currentPatient.patient.last_name)}
                      </>
                    ) : (
                      "Aucun patient en consultation"
                    )}
                  </CardTitle>
                  <CardDescription className="text-lg mt-1">
                    {data.currentPatient ? (
                      <span className="flex items-center gap-2">
                        {new Date().getFullYear() - new Date(data.currentPatient.patient.birth_day!).getFullYear()} ans
                        • {data.currentPatient.type}
                      </span>
                    ) : (
                      "Veuillez sélectionner un patient dans la file d'attente ou appeler le suivant."
                    )}
                  </CardDescription>
                </div>
                {data.currentPatient && (
                  <Avatar className="w-20 h-20 border-4 border-white shadow-sm font-bold text-2xl">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(data.currentPatient.patient.first_name, data.currentPatient.patient.last_name)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto">
              {data.currentPatient ? (
                <Tabs defaultValue="details" className="w-full h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="details">Détails Patient</TabsTrigger>
                    <TabsTrigger value="history">Historique</TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-y-auto pr-2">
                    <TabsContent value="details" className="mt-0 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4" /> Personnel
                          </h4>
                          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                            <div className="flex justify-between border-b pb-2 border-dashed border-gray-200">
                              <span className="text-gray-500">CIN</span>
                              <span className="font-medium">{data.currentPatient.patient.CIN || "N/A"}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2 border-dashed border-gray-200">
                              <span className="text-gray-500">Téléphone</span>
                              <span className="font-medium flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {data.currentPatient.patient.phone_num || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between border-b pb-2 border-dashed border-gray-200">
                              <span className="text-gray-500">Mutuelle</span>
                              <span className="font-medium text-blue-600">{data.currentPatient.patient.mutuelle || "N/A"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Alertes Médicales
                          </h4>
                          <div className="bg-red-50 p-4 rounded-lg space-y-3 border border-red-100">
                            <div className="space-y-1">
                              <span className="text-xs font-semibold text-red-500 uppercase">Allergies</span>
                              <p className="font-medium text-gray-800">{data.currentPatient.patient.allergies || "Aucune"}</p>
                            </div>
                            <div className="space-y-1 pt-2 border-t border-red-100/50">
                              <span className="text-xs font-semibold text-red-500 uppercase">Maladies Chroniques</span>
                              <p className="font-medium text-gray-800">{data.currentPatient.patient.chronic_conditions || "Aucune"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" /> Motif de consultation & Observations
                        </h4>
                        <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100">
                          <p className="text-base text-gray-700 whitespace-pre-wrap">
                            {data.currentPatient.caseDescription?.case_description || data.currentPatient.Diagnostic || data.currentPatient.notes || "Aucun motif spécifié."}
                          </p>
                          {data.currentPatient.caseDescription?.notes && (
                            <div className="mt-4 pt-4 border-t border-blue-100">
                              <span className="text-xs font-semibold text-blue-500 uppercase mb-1 block">Notes complémentaires</span>
                              <p className="text-sm text-gray-600">{data.currentPatient.caseDescription.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </TabsContent>

                    <TabsContent value="history" className="mt-0">
                      <ScrollArea className="h-64 pr-4">
                        {data.patientHistory && data.patientHistory.length > 0 ? (
                          <div className="space-y-3">
                            {data.patientHistory.map((hist) => (
                              <div key={hist.ID_RV} className="flex flex-col p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-sm">
                                      {new Date(hist.appointment_date).toLocaleDateString()}
                                    </span>
                                    <Badge variant="secondary" className="text-[10px]">{hist.type}</Badge>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleViewAppointment(hist.ID_RV)}>
                                    Détails <ChevronRight className="w-3 h-3 ml-1" />
                                  </Button>
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  {hist.caseDescription?.case_description || hist.diagnostic || "Aucune note."}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <History className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-sm">Aucun historique récent disponible.</p>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </div>

                </Tabs>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 opacity-30" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-600">Salle de consultation libre</h3>
                    <p className="text-gray-400 max-w-xs mx-auto mt-2">
                      Sélectionnez un patient dans la liste "En attente" pour commencer une consultation.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="mt-6 animate-pulse"
                    onClick={() => handleNavigatePatient('next')}
                    disabled={data.waitingPatients.length === 0}
                  >
                    Appeler le patient suivant
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>

            {data.currentPatient && (
              <div className="p-6 bg-gray-50 border-t flex justify-between items-center mt-auto">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewPatient(data.currentPatient!.ID_patient)}>
                    Dossier Médical
                  </Button>
                  <Button variant="default" size="sm" onClick={() => handleViewAppointment(data.currentPatient!.ID_RV)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Détails Rendez-vous
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleCancelConsultation}
                    className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 hover:border-red-300 border shadow-none"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleCompleteConsultation}
                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Terminer la consultation
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Queue & Lists */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">
          <Card className="flex-1 flex flex-col shadow-md border-gray-200">
            <CardHeader className="pb-3 bg-gray-50/50 border-b">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" />
                Salle d'attente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <Tabs defaultValue="waiting" className="h-full flex flex-col">
                <div className="px-4 pt-4">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="waiting" className="relative">
                      En attente
                      {data.waitingPatients.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] text-white">
                          {data.waitingPatients.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="preparing" className="relative">
                      En préparation
                      {data.preparingPatients.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] text-white">
                          {data.preparingPatients.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="waiting" className="flex-1 overflow-hidden mt-2">
                  <ScrollArea className="h-full px-4 pb-4">
                    {data.waitingPatients.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {data.waitingPatients.map((patient) => (
                          <div
                            key={patient.ID_RV}
                            className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:border-primary/30 hover:shadow-sm hover:bg-primary/5 transition-all cursor-pointer"
                            onClick={async () => {
                              // If no current patient, start consultation directly
                              if (!data.currentPatient) {
                                const response = await apiClient.updateMedecinStatus(patient.ID_RV, "En consultation")
                                if (response.success) fetchDashboardData()
                              } else {
                                // Otherwise just view details or maybe show alert?
                                // Defaulting to view details as per usual flow
                                handleViewAppointment(patient.ID_RV)
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 bg-yellow-100 text-yellow-700 font-medium text-xs">
                                <AvatarFallback className="bg-yellow-100 text-yellow-700">
                                  {patient.patient.last_name.charAt(0)}{patient.patient.first_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm text-gray-900 leading-none">
                                  {formatName(patient.patient.first_name, patient.patient.last_name)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(patient.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  <span className="mx-1">•</span>
                                  {patient.type}
                                </p>
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm">
                        <Users className="w-8 h-8 mb-2 opacity-20" />
                        Aucun patient en attente
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="preparing" className="flex-1 overflow-hidden mt-2">
                  <ScrollArea className="h-full px-4 pb-4">
                    {data.preparingPatients.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {data.preparingPatients.map((patient) => (
                          <div
                            key={patient.ID_RV}
                            className="group flex items-center justify-between p-3 rounded-lg border border-orange-100 bg-orange-50/30 hover:border-orange-200 transition-all cursor-pointer"
                            onClick={() => handleViewAppointment(patient.ID_RV)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 bg-orange-100 text-orange-700 font-medium text-xs">
                                <AvatarFallback className="bg-orange-100 text-orange-700">
                                  {patient.patient.last_name.charAt(0)}{patient.patient.first_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm text-gray-900 leading-none">
                                  {formatName(patient.patient.first_name, patient.patient.last_name)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Activity className="w-3 h-3" />
                                  Prise de constantes
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        Aucun patient en préparation
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="h-1/3 flex flex-col shadow-sm border-gray-200 bg-gray-50/50">
            <CardHeader className="pb-2 py-3">
              <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">Derniers terminés</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full px-4 pb-4">
                {data.completedPatients.length > 0 ? (
                  <div className="space-y-1">
                    {data.completedPatients.slice(0, 5).map((patient) => (
                      <div key={patient.ID_RV} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm font-medium text-gray-700">
                            {formatName(patient.patient.first_name, patient.patient.last_name)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-blue-600 hover:text-blue-800 px-2"
                          onClick={() => handleReturnToConsultation(patient.ID_RV)}
                        >
                          Rappel
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">
                    Aucun patient terminé.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DoctorDashboard