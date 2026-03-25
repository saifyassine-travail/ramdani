"use client"

import React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { usePatients } from "@/hooks/use-patients"
import { Search, Archive, Eye, Edit, Undo, Plus, User, Phone, FileText, AlertCircle, Loader2, UserCheck, Mail, Heart } from "lucide-react"
import { formatGlobalDate } from "@/lib/format-date"

export default function PatientsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [expandedPatient, setExpandedPatient] = useState<number | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const debounceTimer = useRef<NodeJS.Timeout>()

  const {
    patients,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    perPage,
    fetchPatients,
    searchPatients,
    createPatient,
    updatePatient,
    toggleArchiveStatus,
  } = usePatients(showArchived)

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchTerm])

  const handleDebouncedSearch = useCallback(
    async (term: string) => {
      if (term.trim()) {
        setIsSearching(true)
        try {
          await searchPatients(term)
        } finally {
          setIsSearching(false)
        }
      } else {
        await fetchPatients(1)
      }
    },
    [searchPatients, fetchPatients],
  )

  useEffect(() => {
    handleDebouncedSearch(debouncedSearchTerm)
  }, [debouncedSearchTerm, handleDebouncedSearch])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }

  const handlePageChange = (page: number) => {
    if (!debouncedSearchTerm.trim()) {
      fetchPatients(page)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  const formatDate = (dateString: string) => {
    return formatGlobalDate(dateString)
  }

  const handleToggleArchiveStatus = async (patientId: number) => {
    const result = await toggleArchiveStatus(patientId)
    if (result.success) {
      toast({
        title: "Succès",
        description: result.message || "Statut du patient mis à jour",
      })
    } else {
      toast({
        title: "Erreur",
        description: result.message || "Impossible de mettre à jour le statut",
        variant: "destructive",
      })
    }
  }

  const handleAddPatient = async (formData: any) => {
    const result = await createPatient(formData)
    if (result.success) {
      setIsAddModalOpen(false)
      toast({
        title: "Succès",
        description: "Patient ajouté avec succès",
      })
    } else {
      toast({
        title: "Erreur",
        description: result.message || "Impossible d'ajouter le patient",
        variant: "destructive",
      })
    }
  }

  const handleEditPatient = async (formData: any) => {
    if (!selectedPatient) return

    const result = await updatePatient(selectedPatient.ID_patient, formData)
    if (result.success) {
      setIsEditModalOpen(false)
      setSelectedPatient(null)
      toast({
        title: "Succès",
        description: "Patient mis à jour avec succès",
      })
    } else {
      toast({
        title: "Erreur",
        description: result.message || "Impossible de mettre à jour le patient",
        variant: "destructive",
      })
    }
  }

  // Error display - always visible if there's an error
  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Erreur de chargement</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header - Always visible */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Patients</h1>
            <p className="text-gray-600 mt-1">
              {showArchived ? "Liste des patients archivés" : "Liste des patients actifs"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
              <Input
                type="text"
                placeholder="Rechercher un patient..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-10"
                autoComplete="off"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? "Voir patients actifs" : "Voir patients archivés"}
            </Button>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="h-4 w-4" />
                  Ajouter Patient
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ajouter un nouveau patient</DialogTitle>
                </DialogHeader>
                <PatientForm onSubmit={handleAddPatient} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Patients Table */}
        <Card className="shadow-sm border-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-12"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-24">
                      Âge
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Dernière visite
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Prochaine visite
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider w-40">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                          <span className="ml-2 text-gray-600">Chargement des patients...</span>
                        </div>
                      </td>
                    </tr>
                  ) : patients.length > 0 ? (
                    patients.map((patient) => (
                      <React.Fragment key={patient.ID_patient}>
                        <tr
                          key={`patient-row-${patient.ID_patient}`}
                          className={`cursor-pointer transition-colors hover:bg-gray-50 ${patient.archived ? "opacity-80" : ""}`}
                          onClick={() =>
                            setExpandedPatient(expandedPatient === patient.ID_patient ? null : patient.ID_patient)
                          }
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center ${patient.gender === "Male" ? "bg-blue-100" : "bg-pink-100"
                                }`}
                            >
                              <User
                                className={`h-5 w-5 ${patient.gender === "Male" ? "text-blue-600" : "text-pink-600"}`}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {patient.first_name} {patient.last_name}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {patient.phone_num}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{patient.age || "N/A"} ans</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={patient.archived ? "destructive" : "default"}>
                              {patient.archived ? "Archivé" : "Actif"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {patient.lastAppointment ? formatDate(patient.lastAppointment.appointment_date) : "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {patient.nextAppointment ? formatDate(patient.nextAppointment.appointment_date) : "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/patients/${patient.ID_patient}`)
                                }}
                                className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedPatient(patient)
                                  setIsEditModalOpen(true)
                                }}
                                className="text-green-600 hover:text-green-900 hover:bg-green-50"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleArchiveStatus(patient.ID_patient)
                                }}
                                className={
                                  patient.archived
                                    ? "text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                }
                              >
                                {patient.archived ? <Undo className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {expandedPatient === patient.ID_patient && (
                          <tr key={`patient-details-${patient.ID_patient}`}>
                            <td colSpan={7} className="px-6 py-4 bg-gray-50">
                              <div className="border-l-4 border-indigo-500 pl-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                                      <UserCheck className="h-4 w-4" />
                                      Informations personnelles
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                      <p>
                                        <span className="font-medium">Nom complet:</span> {patient.first_name}{" "}
                                        {patient.last_name}
                                      </p>
                                      <p>
                                        <span className="font-medium">CIN:</span> {patient.CIN}
                                      </p>
                                      <p className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        <span className="font-medium">Email:</span> {patient.email || "N/A"}
                                      </p>
                                      <p>
                                        <span className="font-medium">Mutuelle:</span> {patient.mutuelle || "Aucune"}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                                      <Heart className="h-4 w-4" />
                                      Informations médicales
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                      <p>
                                        <span className="font-medium">Groupe Sanguin:</span>{" "}
                                        <span className="font-bold text-red-600">{patient.blood_type || "N/A"}</span>
                                      </p>
                                      <p className="flex items-start gap-1">
                                        <AlertCircle className="h-3 w-3 mt-0.5 text-red-500" />
                                        <span className="font-medium">Allergies:</span> {patient.allergies || "Aucune"}
                                      </p>
                                      <p>
                                        <span className="font-medium">Maladies chroniques:</span>{" "}
                                        {patient.chronic_conditions || "Aucune"}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      Notes
                                    </h3>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                      {patient.notes || "Aucune note"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <h3 className="text-lg font-medium text-gray-900 mb-1">
                            {debouncedSearchTerm
                              ? "Aucun résultat trouvé"
                              : showArchived
                                ? "Aucun patient archivé trouvé"
                                : "Aucun patient enregistré"}
                          </h3>
                          <p>
                            {debouncedSearchTerm
                              ? `Aucun patient trouvé pour "${debouncedSearchTerm}"`
                              : showArchived
                                ? "Les patients archivés apparaîtront ici"
                                : "Commencez par ajouter un nouveau patient"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!debouncedSearchTerm && totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Affichage de {(currentPage - 1) * perPage + 1} à {Math.min(currentPage * perPage, total)} sur{" "}
                    {total} patients
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                      Précédent
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        )
                      })}
                      {totalPages > 5 && (
                        <>
                          <span className="text-gray-500">...</span>
                          <Button
                            variant={currentPage === totalPages ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(totalPages)}
                            className="w-8 h-8 p-0"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                      Suivant
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Patient Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le patient</DialogTitle>
            </DialogHeader>
            {selectedPatient && (
              <PatientForm initialData={selectedPatient} onSubmit={handleEditPatient} isEdit={true} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
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
    gender: initialData?.gender || "Female",
    birth_day: initialData?.birth_day || "",
    CIN: initialData?.CIN || "",
    phone_num: initialData?.phone_num || "",
    email: initialData?.email || "",
    mutuelle: initialData?.mutuelle || "",
    autre_mutuelle: initialData?.autre_mutuelle || "",
    allergies: initialData?.allergies || "",
    chronic_conditions: initialData?.chronic_conditions || "",

    notes: initialData?.notes || "",
    blood_type: initialData?.blood_type || "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.first_name.trim()) {
      newErrors.first_name = "Le prénom est requis"
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Le nom de famille est requis"
    }
    if (!formData.birth_day) {
      newErrors.birth_day = "La date de naissance est requise"
    }
    if (!formData.CIN.trim()) {
      newErrors.CIN = "Le CIN est requis"
    }
    if (!formData.phone_num.trim()) {
      newErrors.phone_num = "Le numéro de téléphone est requis"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: any) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const submitData = {
      ...formData,
      mutuelle: formData.mutuelle === "AUTRE" ? formData.autre_mutuelle : formData.mutuelle,
    }
    onSubmit(submitData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">
            Prénom <span className="text-red-500">*</span>
          </Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            className={errors.first_name ? "border-red-500" : ""}
            required
          />
          {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
        </div>

        <div>
          <Label htmlFor="last_name">
            Nom de famille <span className="text-red-500">*</span>
          </Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            className={errors.last_name ? "border-red-500" : ""}
            required
          />
          {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
        </div>

        <div>
          <Label htmlFor="gender">Sexe</Label>
          <Select value={formData.gender} onValueChange={(value) => handleChange("gender", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Female">Femme</SelectItem>
              <SelectItem value="Male">Homme</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="birth_day">
            Date de naissance <span className="text-red-500">*</span>
          </Label>
          <Input
            id="birth_day"
            type="date"
            value={formData.birth_day}
            onChange={(e) => handleChange("birth_day", e.target.value)}
            className={errors.birth_day ? "border-red-500" : ""}
            required
          />
          {errors.birth_day && <p className="text-red-500 text-sm mt-1">{errors.birth_day}</p>}
        </div>

        <div>
          <Label htmlFor="CIN">
            CIN <span className="text-red-500">*</span>
          </Label>
          <Input
            id="CIN"
            value={formData.CIN}
            onChange={(e) => handleChange("CIN", e.target.value)}
            className={errors.CIN ? "border-red-500" : ""}
            required
          />
          {errors.CIN && <p className="text-red-500 text-sm mt-1">{errors.CIN}</p>}
        </div>

        <div>
          <Label htmlFor="phone_num">
            Téléphone <span className="text-red-500">*</span>
          </Label>
          <Input
            id="phone_num"
            type="tel"
            value={formData.phone_num}
            onChange={(e) => handleChange("phone_num", e.target.value)}
            className={errors.phone_num ? "border-red-500" : ""}
            required
          />
          {errors.phone_num && <p className="text-red-500 text-sm mt-1">{errors.phone_num}</p>}
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
              <SelectItem value="NONE">Aucune</SelectItem>
              <SelectItem value="CNSS">CNSS</SelectItem>
              <SelectItem value="CNOPS">CNOPS</SelectItem>
              <SelectItem value="FAR">FAR</SelectItem>
              <SelectItem value="ONE">ONE</SelectItem>
              <SelectItem value="AUTRE">AUTRE</SelectItem>
            </SelectContent>
          </Select>
          {formData.mutuelle === "AUTRE" && (
            <div className="mt-2">
              <Label htmlFor="autre_mutuelle">Sélectionner l'assurance</Label>
              <Select
                value={formData.autre_mutuelle || ""}
                onValueChange={(value) => handleChange("autre_mutuelle", value)}
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
                  <SelectItem value="AUTRE">AUTRE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div>
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
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline">
          Annuler
        </Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
          {isEdit ? "Mettre à jour" : "Enregistrer"}
        </Button>
      </div>
    </form>
  )
}
