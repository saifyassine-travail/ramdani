"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient } from "../lib/api"
import type { Patient } from "../lib/api"

export interface PatientWithDetails extends Patient {
  age?: number
  lastAppointment?: {
    appointment_date: string
    type?: string
    diagnostic?: string
  }
  nextAppointment?: {
    appointment_date: string
  }
}

export function usePatients(showArchived = false) {
  const [patients, setPatients] = useState<PatientWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const fetchPatients = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiClient.getPatients(showArchived, page, perPage)

        if (response && response.success && response.data) {
          let patientsArray = []
          let paginationInfo = { total: 0, current_page: 1, last_page: 1, per_page: 10 }

          if (response.data.data && Array.isArray(response.data.data)) {
            // Laravel pagination response
            patientsArray = response.data.data
            paginationInfo = {
              total: response.data.total || 0,
              current_page: response.data.current_page || 1,
              last_page: response.data.last_page || 1,
              per_page: response.data.per_page || 10,
            }
          } else if (Array.isArray(response.data)) {
            // Direct array response
            patientsArray = response.data
            paginationInfo = {
              total: response.data.length,
              current_page: 1,
              last_page: 1,
              per_page: response.data.length,
            }
          }

          if (Array.isArray(patientsArray)) {
            // Transform the data to match the frontend interface.
            // Laravel serializes the eager-loaded relationships with snake_case
            // keys (last_appointment / next_appointment), so read those.
            const transformedPatients = patientsArray.map((patient) => {
              const last = patient.last_appointment ?? patient.lastAppointment
              const next = patient.next_appointment ?? patient.nextAppointment
              return {
                ...patient,
                id: patient.ID_patient,
                archived: Boolean(patient.archived),
                age: patient.birth_day ? calculateAge(patient.birth_day) : undefined,
                lastAppointment: last
                  ? {
                      appointment_date: last.appointment_date,
                      type: last.type,
                      diagnostic: last.diagnostic,
                    }
                  : undefined,
                nextAppointment: next
                  ? {
                      appointment_date: next.appointment_date,
                    }
                  : undefined,
              }
            })

            setPatients(transformedPatients)
            setTotal(paginationInfo.total)
            setCurrentPage(paginationInfo.current_page)
            setTotalPages(paginationInfo.last_page)
            setPerPage(paginationInfo.per_page)
          } else {
            setError("Invalid data format received")
            setPatients([])
          }
        } else {
          setError("Failed to fetch patients - unexpected response format")
          setPatients([])
        }
      } catch (err) {
        setError("Network error occurred")
        setPatients([])
      } finally {
        setLoading(false)
      }
    },
    [showArchived, perPage],
  )

  const searchPatients = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        fetchPatients(1)
        return
      }

      try {
        setError(null)

        const response = await apiClient.searchPatientsDetailed(term, showArchived)

        if (response && response.success) {
          let searchResults = []

          // Handle different possible response formats
          if (response.data) {
            if (Array.isArray(response.data)) {
              // Direct array response
              searchResults = response.data
            } else if (response.data.data && Array.isArray(response.data.data)) {
              // Paginated response
              searchResults = response.data.data
            } else if (typeof response.data === "object" && response.data !== null) {
              // Single object response - convert to array
              searchResults = [response.data]
            } else {
              setError("Search returned unexpected data format")
              setPatients([])
              return
            }
          } else {
            searchResults = []
          }

          const transformedPatients = searchResults
            .map((patient, index) => {
              try {
                return {
                  ID_patient: patient.ID_patient || patient.id,
                  first_name: patient.first_name || "",
                  last_name: patient.last_name || "",
                  birth_day: patient.birth_day,
                  gender: patient.gender,
                  CIN: patient.CIN || patient.cin,
                  phone_num: patient.phone_num || patient.phone,
                  email: patient.email,
                  mutuelle: patient.mutuelle,
                  allergies: patient.allergies,
                  chronic_conditions: patient.chronic_conditions,
                  notes: patient.notes,
                  archived: Boolean(patient.archived),
                  id: patient.ID_patient || patient.id,
                  age: patient.age || (patient.birth_day ? calculateAge(patient.birth_day) : undefined),
                  lastAppointment:
                    patient.lastAppointment || patient.last_visit
                      ? {
                          appointment_date: patient.lastAppointment?.appointment_date || patient.last_visit,
                          type: patient.lastAppointment?.type,
                          diagnostic: patient.lastAppointment?.diagnostic,
                        }
                      : undefined,
                  nextAppointment:
                    patient.nextAppointment || patient.next_visit
                      ? {
                          appointment_date: patient.nextAppointment?.appointment_date || patient.next_visit,
                        }
                      : undefined,
                }
              } catch (transformError) {
                return null
              }
            })
            .filter(Boolean) // Remove any null entries from transformation errors

          setPatients(transformedPatients)
          setTotal(transformedPatients.length)
          // Reset pagination for search results
          setCurrentPage(1)
          setTotalPages(1)
        } else {
          setError("Search request failed")
          setPatients([])
        }
      } catch (err) {
        setError(`Search error: ${err.message || "Network error occurred"}`)
        setPatients([])
      }
    },
    [showArchived, fetchPatients],
  )

  const createPatient = async (patientData: any) => {
    try {
      const response = await apiClient.createPatient({
        ...patientData,
        mutuelle: patientData.mutuelle === "none" ? undefined : patientData.mutuelle,
      })

      if (response.success) {
        fetchPatients() // Refresh the list
        return { success: true }
      } else {
        return { success: false, message: response.message || "Failed to create patient" }
      }
    } catch (err) {
      return { success: false, message: "Network error occurred" }
    }
  }

  const updatePatient = async (id: number, patientData: any) => {
    try {
      const response = await apiClient.updatePatient(id, {
        ...patientData,
        mutuelle: patientData.mutuelle === "none" ? undefined : patientData.mutuelle,
      })

      if (response.success) {
        fetchPatients() // Refresh the list
        return { success: true }
      } else {
        return { success: false, message: response.message || "Failed to update patient" }
      }
    } catch (err) {
      return { success: false, message: "Network error occurred" }
    }
  }

  const toggleArchiveStatus = async (patientId: number) => {
    const patient = patients.find((p) => p.ID_patient === patientId || (p as any).id === patientId)
    if (!patient) return { success: false, message: "Patient not found" }

    // Optimistically drop the patient from the current view: archiving removes it
    // from the active list, restoring removes it from the archived list. This makes
    // the change visible immediately instead of waiting on the background refetch.
    const previousPatients = patients
    const previousTotal = total
    setPatients((cur) => cur.filter((p) => p.ID_patient !== patientId && (p as any).id !== patientId))
    setTotal((t) => Math.max(0, t - 1))

    try {
      const response = await apiClient.archivePatient(patientId, !patient.archived, showArchived)

      if (response.success) {
        fetchPatients(currentPage) // Reconcile counts/pagination in the background
        return { success: true, message: response.data?.message }
      }

      // Revert on failure
      setPatients(previousPatients)
      setTotal(previousTotal)
      return { success: false, message: response.message || "Failed to update patient status" }
    } catch (err) {
      setPatients(previousPatients)
      setTotal(previousTotal)
      return { success: false, message: "Network error occurred" }
    }
  }

  useEffect(() => {
    fetchPatients(1)

    const handlePatientAdded = (event: CustomEvent) => {
      const newPatient = event.detail?.patient
      if (newPatient) {
        const transformedPatient = {
          ...newPatient,
          id: newPatient.ID_patient,
          archived: Boolean(newPatient.archived),
          age: newPatient.birth_day ? calculateAge(newPatient.birth_day) : undefined,
        }
        setPatients((prev) => [transformedPatient, ...prev])
        setTotal((prev) => prev + 1)
      }
    }

    window.addEventListener("patientAdded", handlePatientAdded as EventListener)
    return () => {
      window.removeEventListener("patientAdded", handlePatientAdded as EventListener)
    }
  }, [fetchPatients])

  return {
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
  }
}

function calculateAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}
