"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { apiClient } from "../lib/api"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { useCalendar } from "@/hooks/use-calendar" // Import useCalendar hook

const Calendar = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const Clock = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
)

const User = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const Plus = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const Search = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const ChevronLeft = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="15,18 9,12 15,6" />
  </svg>
)

const Home = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9,22 9,12 15,12 15,22" />
  </svg>
)

const CalendarDays = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" />
    <line x1="12" y1="14" x2="12" y2="14" />
    <line x1="16" y1="14" x2="16" y2="14" />
    <line x1="8" y1="18" x2="8" y2="18" />
    <line x1="12" y1="18" x2="12" y2="18" />
    <line x1="16" y1="18" x2="16" y2="18" />
  </svg>
)

const Bell = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 0-3.46 0" />
  </svg>
)

const Settings = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0 1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51 1z" />
  </svg>
)

const MedicalHeader = () => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; first_name: string; last_name: string; phone: string }>
  >([])
  const [isSearching, setIsSearching] = useState(false)
  const [patientFormError, setPatientFormError] = useState("")
  const [appointmentFormError, setAppointmentFormError] = useState("")
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  const router = useRouter()
  const { toast } = useToast()
  const { logout, user } = useAuth()
  const { appointmentCounts } = useCalendar() // Fetch appointment data

  const [patientFormData, setPatientFormData] = useState({
    first_name: "",
    last_name: "",
    gender: "Male",
    birth_day: "",
    CIN: "",
    phone_num: "",
    email: "",
    mutuelle: "",
    autre_mutuelle: "",
    allergies: "",
    chronic_conditions: "",
    notes: "",
  })

  const [appointmentFormData, setAppointmentFormData] = useState({
    patient_id: 0,
    type: "Consultation",
    appointment_date: "",
    appointment_time: "",
    notes: "",
  })

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setPatientFormError("")

    const errors: string[] = []

    if (!patientFormData.first_name.trim()) {
      errors.push("Le prénom est requis")
    }
    if (!patientFormData.last_name.trim()) {
      errors.push("Le nom de famille est requis")
    }
    if (!patientFormData.birth_day) {
      errors.push("La date de naissance est requise")
    }
    if (!patientFormData.CIN.trim()) {
      errors.push("Le CIN est requis")
    }
    if (!patientFormData.phone_num.trim()) {
      errors.push("Le téléphone est requis")
    }

    if (errors.length > 0) {
      const errorMessage = errors.join(", ")
      setPatientFormError(errorMessage)
      toast({
        title: "Erreur de validation",
        description: errorMessage,
        variant: "destructive",
      })
      return
    }

    console.log("[v0] Submitting patient form with data:", patientFormData)

    try {
      const response = await apiClient.createPatient(patientFormData)
      console.log("[v0] Create patient response:", response)

      if (response.success) {
        toast({
          title: "Succès",
          description: "Patient ajouté avec succès",
        })
        setIsPatientModalOpen(false)
        setPatientFormData({
          first_name: "",
          last_name: "",
          gender: "Male",
          birth_day: "",
          CIN: "",
          phone_num: "",
          email: "",
          mutuelle: "",
          autre_mutuelle: "",
          allergies: "",
          chronic_conditions: "",
          notes: "",
        })
      } else {
        const errorMessage = response.message || "Impossible d'ajouter le patient"
        setPatientFormError(errorMessage)
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error creating patient:", error)
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue"
      setPatientFormError(errorMessage)
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    setAppointmentFormError("")
    console.log("[v0] Submitting appointment form")
    console.log("[v0] Search term:", searchTerm)
    console.log("[v0] Selected patient ID:", selectedPatientId)
    console.log("[v0] Form data:", appointmentFormData)

    try {
      if (!selectedPatientId) {
        const errorMessage = "Veuillez sélectionner un patient"
        setAppointmentFormError(errorMessage)
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      const appointmentDateTime = appointmentFormData.appointment_time
        ? `${appointmentFormData.appointment_date} ${appointmentFormData.appointment_time}:00`
        : `${appointmentFormData.appointment_date} 00:00:00`

      console.log("[v0] Combined date-time:", appointmentDateTime)

      const appointmentPayload = {
        patient_id: selectedPatientId,
        type: appointmentFormData.type,
        appointment_date: appointmentDateTime,
        notes: appointmentFormData.notes,
      }
      console.log("[v0] Appointment payload:", appointmentPayload)

      const response = await apiClient.createAppointment(appointmentPayload)
      console.log("[v0] Create appointment response:", response)

      if (response.success) {
        toast({
          title: "Succès",
          description: "Rendez-vous créé avec succès",
        })
        setIsAppointmentModalOpen(false)
        setSearchTerm("")
        setSearchResults([])
        setSelectedPatientId(null)
        setAppointmentFormData({
          patient_id: 0,
          type: "Consultation",
          appointment_date: "",
          appointment_time: "",
          notes: "",
        })
        window.dispatchEvent(new Event("appointmentCreated"))
      } else {
        let errorMessage = response.message || "Impossible de créer le rendez-vous"

        if (response.message && response.message.toLowerCase().includes("consultation")) {
          errorMessage = "Ce patient est déjà en consultation. Veuillez attendre la fin de la consultation actuelle."
        } else if (response.message && response.message.toLowerCase().includes("already")) {
          errorMessage = "Ce patient est déjà en consultation. Veuillez attendre la fin de la consultation actuelle."
        }

        setAppointmentFormError(errorMessage)
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error creating appointment:", error)
      let errorMessage = error instanceof Error ? error.message : "Une erreur est survenue"

      if (errorMessage.toLowerCase().includes("consultation")) {
        errorMessage = "Ce patient est déjà en consultation. Veuillez attendre la fin de la consultation actuelle."
      }

      setAppointmentFormError(errorMessage)
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handlePatientSearch = async (term: string) => {
    setSearchTerm(term)

    if (term.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await apiClient.searchPatients(term)
      console.log("[v0] Patient search response:", response)

      if (response.success && response.data) {
        const patients = response.data.map((p: any) => ({
          id: p.ID_patient || p.id,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          phone: p.phone_num || p.phone || "",
        }))
        setSearchResults(patients)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error("[v0] Error searching patients:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const renderCompactCalendar = () => {
    const monthNames = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ]
    const dayNames = ["D", "L", "M", "M", "J", "V", "S"]

    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days = []

    // Day headers
    dayNames.forEach((day, index) => {
      days.push(
        <div key={`header-${index}`} className="font-medium text-gray-400 text-center text-xs p-1">
          {day}
        </div>,
      )
    })

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-1"></div>)
    }

    const getCountColor = (count: number) => {
      if (count === 0) return "bg-gray-300"
      if (count <= 5) return "bg-green-500"
      if (count <= 15) return "bg-yellow-500"
      if (count <= 25) return "bg-orange-500"
      return "bg-red-500"
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const isToday = dateString === new Date().toISOString().split("T")[0]
      const count = appointmentCounts[dateString] || 0
      const colorClass = getCountColor(count)

      days.push(
        <div
          key={day}
          className={`p-1 text-xs text-center rounded relative group cursor-pointer ${isToday ? "bg-blue-500 text-white font-semibold" : "text-gray-700 hover:bg-gray-100"
            }`}
          title={count > 0 ? `${count} patient${count > 1 ? "s" : ""}` : "Aucun patient"}
        >
          <div>{day}</div>
          <div className="absolute bottom-0.5 right-0.5">
            <div
              className={`${colorClass} w-1.5 h-1.5 rounded-full shadow-sm transition-all group-hover:w-2 group-hover:h-2`}
              title={count > 0 ? `${count} patient${count > 1 ? "s" : ""}` : "Aucun patient"}
            ></div>
          </div>
          {count > 0 && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {count} patient{count > 1 ? "s" : ""}
            </div>
          )}
        </div>,
      )
    }

    return days
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100" onClick={() => router.back()}>
              <ChevronLeft />
              <span className="ml-2">Retour</span>
            </Button>

            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <Home />
              <span>/</span>
              <span>Tableau de bord</span>
            </nav>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="flex items-center space-x-2">
                <Clock className="text-blue-600" />
                <span className="text-lg font-mono font-semibold text-gray-800">{formatTime(currentTime)}</span>
              </div>
              <div className="text-xs text-gray-500">{formatDate(currentTime)}</div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Dialog open={isPatientModalOpen} onOpenChange={setIsPatientModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-[#007090] text-white hover:bg-[#005570] shadow-md transition-all hover:scale-105">
                    <Plus />
                    <span className="ml-2">Nouveau Patient</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Ajouter un Nouveau Patient</DialogTitle>
                  </DialogHeader>
                  {patientFormError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{patientFormError}</p>
                    </div>
                  )}
                  <form onSubmit={handleAddPatient} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-1">
                        <Label htmlFor="firstName" className="text-gray-700">
                          Prénom
                        </Label>
                        <Input
                          id="firstName"
                          placeholder="Prénom"
                          value={patientFormData.first_name}
                          onChange={(e) => setPatientFormData({ ...patientFormData, first_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-span-1">
                        <Label htmlFor="lastName" className="text-gray-700">
                          Nom de famille
                        </Label>
                        <Input
                          id="lastName"
                          placeholder="Nom de famille"
                          value={patientFormData.last_name}
                          onChange={(e) => setPatientFormData({ ...patientFormData, last_name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender" className="text-gray-700">
                          Sexe
                        </Label>
                        <Select
                          value={patientFormData.gender}
                          onValueChange={(value: "Male" | "Female") =>
                            setPatientFormData({ ...patientFormData, gender: value })
                          }
                        >
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
                        <Label htmlFor="birthDate" className="text-gray-700">
                          Date de naissance
                        </Label>
                        <Input
                          id="birthDate"
                          type="date"
                          value={patientFormData.birth_day}
                          onChange={(e) => setPatientFormData({ ...patientFormData, birth_day: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cin" className="text-gray-700">
                          CIN
                        </Label>
                        <Input
                          id="cin"
                          placeholder="CIN"
                          value={patientFormData.CIN}
                          onChange={(e) => setPatientFormData({ ...patientFormData, CIN: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-gray-700">
                          Téléphone
                        </Label>
                        <Input
                          id="phone"
                          placeholder="01 23 45 67 89"
                          value={patientFormData.phone_num}
                          onChange={(e) => setPatientFormData({ ...patientFormData, phone_num: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="email" className="text-gray-700">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@exemple.com"
                          value={patientFormData.email}
                          onChange={(e) => setPatientFormData({ ...patientFormData, email: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="mutuelle" className="text-gray-700">
                          Mutuelle
                        </Label>
                        <Select
                          value={patientFormData.mutuelle}
                          onValueChange={(value) => setPatientFormData({ ...patientFormData, mutuelle: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une mutuelle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Aucun">Aucun</SelectItem>
                            <SelectItem value="CNSS">CNSS</SelectItem>
                            <SelectItem value="CNOPS">CNOPS</SelectItem>
                            <SelectItem value="FAR">FAR</SelectItem>
                            <SelectItem value="ONE">ONE</SelectItem>
                            <SelectItem value="AUTRE">AUTRE</SelectItem>
                          </SelectContent>
                        </Select>
                        {patientFormData.mutuelle === "AUTRE" && (
                          <div className="mt-2">
                            <Label htmlFor="autre_mutuelle" className="text-gray-700">
                              Sélectionner l'assurance
                            </Label>
                            <Select
                              value={patientFormData.autre_mutuelle || ""}
                              onValueChange={(value) =>
                                setPatientFormData({ ...patientFormData, autre_mutuelle: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir une assurance" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AXA">AXA</SelectItem>
                                <SelectItem value="RMA">RMA</SelectItem>
                                <SelectItem value="CHIM">CHIM</SelectItem>
                                <SelectItem value="MASS">MASS</SelectItem>
                                <SelectItem value="BP">BP</SelectItem>
                                <SelectItem value="WAFA">WAFA</SelectItem>
                                <SelectItem value="SAHAM">SAHAM</SelectItem>
                                <SelectItem value="ATAL">ATAL</SelectItem>
                                <SelectItem value="MGB">MGB</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="allergies" className="text-gray-700">
                        Allergies
                      </Label>
                      <Textarea
                        id="allergies"
                        placeholder="Allergies"
                        value={patientFormData.allergies}
                        onChange={(e) => setPatientFormData({ ...patientFormData, allergies: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="chronic" className="text-gray-700">
                        Maladies chroniques
                      </Label>
                      <Textarea
                        id="chronic"
                        placeholder="Maladies chroniques"
                        value={patientFormData.chronic_conditions}
                        onChange={(e) => setPatientFormData({ ...patientFormData, chronic_conditions: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes" className="text-gray-700">
                        Notes
                      </Label>
                      <Textarea
                        id="notes"
                        placeholder="Notes additionnelles..."
                        value={patientFormData.notes}
                        onChange={(e) => setPatientFormData({ ...patientFormData, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsPatientModalOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" className="bg-[#007090] text-white hover:bg-[#006080]">
                        Ajouter Patient
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isAppointmentModalOpen} onOpenChange={setIsAppointmentModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#007090] text-[#007090] hover:bg-blue-50 bg-transparent"
                  >
                    <Calendar />
                    <span className="ml-2">Nouveau RV</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Planifier un Rendez-vous</DialogTitle>
                  </DialogHeader>
                  {appointmentFormError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{appointmentFormError}</p>
                    </div>
                  )}
                  <form onSubmit={handleAddAppointment} className="space-y-4">
                    <div>
                      <Label htmlFor="patientSearch" className="text-gray-700">
                        Rechercher un patient
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="patientSearch"
                          placeholder="Nom du patient..."
                          className="pl-10"
                          value={searchTerm}
                          onChange={(e) => handlePatientSearch(e.target.value)}
                          required
                        />
                      </div>
                      {searchTerm && searchResults.length > 0 && (
                        <div className="mt-2 border rounded-md max-h-32 overflow-y-auto bg-white">
                          {searchResults.map((patient) => (
                            <div
                              key={patient.id}
                              className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                              onClick={() => {
                                setSearchTerm(`${patient.first_name} ${patient.last_name}`)
                                setSelectedPatientId(patient.id)
                                setSearchResults([])
                              }}
                            >
                              <div className="font-medium text-gray-900">
                                {patient.first_name} {patient.last_name}
                              </div>
                              <div className="text-sm text-gray-600">{patient.phone}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {isSearching && <div className="mt-2 text-sm text-gray-500">Recherche en cours...</div>}
                      {searchTerm && !isSearching && searchResults.length === 0 && searchTerm.length >= 2 && (
                        <div className="mt-2 text-sm text-gray-500">Aucun patient trouvé</div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="appointmentDate" className="text-gray-700">
                          Date
                        </Label>
                        <Input
                          id="appointmentDate"
                          type="date"
                          value={appointmentFormData.appointment_date}
                          onChange={(e) =>
                            setAppointmentFormData({ ...appointmentFormData, appointment_date: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Input
                          id="appointmentTime"
                          type="time"
                          value={appointmentFormData.appointment_time}
                          onChange={(e) =>
                            setAppointmentFormData({ ...appointmentFormData, appointment_time: e.target.value })
                          }
                          className="font-medium mt-6"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="appointmentType" className="text-gray-700">
                        Type de consultation
                      </Label>
                      <Select
                        value={appointmentFormData.type}
                        onValueChange={(value: "Consultation" | "Control") =>
                          setAppointmentFormData({ ...appointmentFormData, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Consultation">Consultation</SelectItem>
                          <SelectItem value="Control">Contrôle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="appointmentNotes" className="text-gray-700">
                        Notes
                      </Label>
                      <Textarea
                        id="appointmentNotes"
                        placeholder="Notes additionnelles..."
                        value={appointmentFormData.notes}
                        onChange={(e) => setAppointmentFormData({ ...appointmentFormData, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsAppointmentModalOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" className="bg-[#007090] text-white hover:bg-[#006080]">
                        Planifier
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors">
                  <CalendarDays className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-3" align="end">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))
                      }
                      className="text-gray-600 hover:text-blue-500 p-1"
                    >
                      <ChevronLeft />
                    </button>
                    <h4 className="text-sm font-medium">
                      {
                        [
                          "Janvier",
                          "Février",
                          "Mars",
                          "Avril",
                          "Mai",
                          "Juin",
                          "Juillet",
                          "Août",
                          "Septembre",
                          "Octobre",
                          "Novembre",
                          "Décembre",
                        ][calendarMonth.getMonth()]
                      }{" "}
                      {calendarMonth.getFullYear()}
                    </h4>
                    <button
                      onClick={() =>
                        setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))
                      }
                      className="text-gray-600 hover:text-blue-500 p-1 rotate-180"
                    >
                      <ChevronLeft />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">{renderCompactCalendar()}</div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center space-x-3">
              <div
                className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-100"
                onClick={() => router.push("/profile")}
              >
                <div className="text-sm text-right hidden md:block">
                  <div className="font-semibold text-gray-800">{user?.name || "Dr. Sarah Johnson"}</div>
                  <div className="text-blue-600 text-xs font-medium">{user?.role || "Médecin"}</div>
                </div>
                <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-gray-200">
                  <AvatarImage src={user?.avatar || "/professional-doctor-avatar.png"} />
                  <AvatarFallback className="bg-[#007090] text-white">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default MedicalHeader
