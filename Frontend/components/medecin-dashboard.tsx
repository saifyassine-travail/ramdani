"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { useMedecinDashboard } from "../hooks/use-medecin-dashboard"
import { medecinApiClient } from "../lib/medecin-api"
import { formatName } from "../lib/utils"

export default function MedecinDashboard() {
  const { dashboardData, loading, error, updateStatus, navigatePatient, returnToConsultation } = useMedecinDashboard()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [dateAppointments, setDateAppointments] = useState<any[]>([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)

  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    setLoadingAppointments(true)
    try {
      const response = await medecinApiClient.getAppointmentsByDate(date)
      if (response.success && response.data) {
        setDateAppointments(response.data.appointments || [])
      }
    } catch (err) {
      console.error("Error fetching appointments:", err)
    } finally {
      setLoadingAppointments(false)
    }
  }

  const showNotification = (message: string, type: "success" | "error") => {
    const notification = document.createElement("div")
    notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-md ${
      type === "error" ? "bg-red-500" : "bg-green-500"
    } text-white max-w-md z-50`
    notification.textContent = message
    document.body.appendChild(notification)
    setTimeout(() => notification.remove(), 3000)
  }

  const handleStatusUpdate = async (appointmentId: number, status: string) => {
    const result = await updateStatus(appointmentId, status)
    if (result.success) {
      showNotification("Statut mis à jour avec succès", "success")
    } else {
      showNotification(result.message || "Erreur lors de la mise à jour", "error")
    }
  }

  const handleNavigation = async (direction: "next" | "previous") => {
    const result = await navigatePatient(direction)
    if (result.success) {
      showNotification(`Patient ${direction === "next" ? "suivant" : "précédent"} sélectionné`, "success")
    } else {
      showNotification(result.message || "Erreur lors de la navigation", "error")
    }
  }

  const handleReturnToConsultation = async (appointmentId: number) => {
    const result = await returnToConsultation(appointmentId)
    if (result.success) {
      showNotification("Retour à la consultation effectué", "success")
    } else {
      showNotification(result.message || "Erreur lors du retour", "error")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-600 mb-2 font-semibold">Erreur de chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#3a0ca3]">Tableau de Bord Médecin</h1>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Current Patient Section */}
      {dashboardData?.currentPatient && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Patient Actuel</span>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">
                En consultation
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{formatName(dashboardData.currentPatient.first_name, dashboardData.currentPatient.last_name)}</h3>
                <p className="text-gray-600">ID: {dashboardData.currentPatient.appointmentId}</p>
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => handleNavigation("previous")} variant="outline" size="sm">
                  ← Précédent
                </Button>
                <Button onClick={() => handleNavigation("next")} variant="outline" size="sm">
                  Suivant →
                </Button>
                <Button
                  onClick={() => window.open(`/patient/${dashboardData.currentPatient?.id}`, "_blank")}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  Détails Patient
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Aujourd'hui</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{dashboardData?.todayStats.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Terminés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dashboardData?.todayStats.completed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">En Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{dashboardData?.todayStats.waiting || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">En Consultation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{dashboardData?.todayStats.consulting || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Next Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prochains Rendez-vous</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData?.nextAppointments?.length ? (
                dashboardData.nextAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{formatName(appointment.patient?.first_name || "", appointment.patient?.last_name || "")}</p>
                      <p className="text-sm text-gray-600">
                        {appointment.time} - {appointment.type}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => window.open(`/appointment/${appointment.id}`, "_blank")}
                        variant="outline"
                        size="sm"
                      >
                        Détails
                      </Button>
                      <Button
                        onClick={() => handleReturnToConsultation(appointment.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Consulter
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun rendez-vous à venir</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Appointments by Date */}
        <Card>
          <CardHeader>
            <CardTitle>Rendez-vous du {selectedDate}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAppointments ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-600">Chargement...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dateAppointments.length ? (
                  dateAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{formatName(appointment.patient?.first_name || "", appointment.patient?.last_name || "") || "Patient inconnu"}</p>
                        <p className="text-sm text-gray-600">{appointment.type}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            appointment.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : appointment.status === "consulting"
                                ? "bg-blue-100 text-blue-700"
                                : appointment.status === "waiting"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => window.open(`/appointment/${appointment.id}`, "_blank")}
                          variant="outline"
                          size="sm"
                        >
                          Détails
                        </Button>
                        {appointment.status !== "completed" && (
                          <Button
                            onClick={() => handleStatusUpdate(appointment.id, "completed")}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Terminer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">Aucun rendez-vous pour cette date</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => window.open("/appointments", "_blank")}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm">Tous les RDV</span>
            </Button>

            <Button
              onClick={() => window.open("/patients", "_blank")}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
              <span className="text-sm">Patients</span>
            </Button>

            <Button
              onClick={() => window.open("/completed-appointments", "_blank")}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm">RDV Terminés</span>
            </Button>

            <Button
              onClick={() => window.open("/reports", "_blank")}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center space-y-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span className="text-sm">Rapports</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
