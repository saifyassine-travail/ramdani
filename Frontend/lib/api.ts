const API_BASE_URL = "http://127.0.0.1:8000/api"
import { getAuthToken } from "@/lib/auth-api"


// if (!process.env.NEXT_PUBLIC_API_URL) {
//   throw new Error("NEXT_PUBLIC_API_URL is not defined");
// }

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;


const requestCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 30000 // 30 seconds

export interface UserProfile {
  id: number
  name: string
  email: string
  phone?: string
  address?: string
  specialization?: string
  bio?: string
  license?: string
  experience?: string
  education?: string
  avatar?: string
  role?: string
}

export interface Patient {
  ID_patient: number
  first_name: string
  last_name: string
  birth_day?: string
  gender?: string
  CIN?: string
  phone_num?: string
  mutuelle?: string | null
  allergies?: string
  chronic_conditions?: string
  email?: string | null
  notes?: string | null
  archived: number
  DDR?: string
  created_at?: string
  updated_at?: string
}

export interface Appointment {
  ID_RV: number
  appointment_date: string
  type: string
  status: string
  start_time?: string | null
  end_time?: string | null
  diagnostic?: string
  mutuelle: boolean | number // Can be 0/1 from Laravel or boolean from frontend
  payement?: number
  ID_patient: number
  created_at?: string
  updated_at?: string
  patient: Patient
  notes?: string
  caseDescription?: CaseDescription
  medicaments?: Medicament[]
  analyses?: Analysis[]
  medical_acts?: string[]
}

export interface CaseDescription {
  case_description?: string
  weight?: number
  pulse?: number
  temperature?: number
  blood_pressure?: string
  tall?: number
  spo2?: null
  notes?: string
}

export interface Medicament {
  ID_Medicament: number
  name: string
  price: number
  description?: string
  dosage?: string
  composition?: string
  archived: boolean | number // Backend returns 0/1, frontend uses boolean
  created_at?: string
  updated_at?: string
  pivot?: {
    dosage?: string
    frequence?: string
    duree?: string
  }
}

export interface Analysis {
  ID_Analyse: number
  type_analyse: string
  departement?: string
  archived?: boolean | number // Backend returns 0/1, frontend uses boolean
  created_at?: string
  updated_at?: string
}

export interface PatientDocument {
  id: number
  ID_patient: number
  document_name: string
  document_type: string
  file_path: string
  file_size: number
  uploaded_at: string
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  error?: string
  errors?: Record<string, string[]>
  meta?: {
    current_page: number
    last_page: number
    total: number
    per_page: number
    [key: string]: any
  }
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, skipCache = false): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`

      if (!skipCache && (options.method === undefined || options.method === "GET")) {
        const cached = requestCache.get(url)
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          return {
            success: true,
            data: cached.data as T,
          }
        }
      }

      let headers: Record<string, string> = {
        Accept: "application/json",
      }

      if (options.headers) {
        Object.assign(headers, options.headers)
      }

      // Attach Bearer token if available
      const token = getAuthToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const textResponse = await response.text()
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          error: textResponse,
        }
      }
      const data = await response.json()

      if (options.method === undefined || options.method === "GET") {
        requestCache.set(url, { data, timestamp: Date.now() })
      }

      return {
        success: true,
        data: data as T,
      }
    } catch (error) {
      let errorMessage = "Network error occurred"
      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "Cannot connect to server. Check if Laravel backend is running."
      } else if (error instanceof SyntaxError) {
        errorMessage = "Server returned invalid JSON response"
      }

      return {
        success: false,
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async getAppointments(date?: string, skipCache = false): Promise<
    ApiResponse<{
      appointments: Appointment[]
      grouped: Record<string, Appointment[]>
      count: number
      date: string
    }>
  > {
    const endpoint = date ? `/appointments/${date}` : "/appointments"
    return this.request(endpoint, {}, skipCache)
  }

  async getMonthlyCounts(yearMonth: string): Promise<ApiResponse<Record<string, number>>> {
    const response = await this.request<Record<string, number> | { data: Record<string, number> }>(
      `/appointments/monthly-counts/${yearMonth}`,
    )

    if (response.success && response.data) {
      const data = response.data as any
      // If data has a 'data' property, extract it; otherwise use data directly
      const counts = data.data || data
      return {
        success: true,
        data: counts as Record<string, number>,
      }
    }

    return response as ApiResponse<Record<string, number>>
  }

  async updateAppointmentStatus(
    appointmentId: number,
    status: string,
  ): Promise<
    ApiResponse<{
      status: string
      colors?: {
        bg?: string
        border?: string
        text?: string
      }
    }>
  > {
    console.log("[v0] API updateAppointmentStatus called with:", { appointmentId, status })
    return this.request("/appointments/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointment_id: appointmentId,
        status, // This should be the English key like 'consulting', 'waiting', etc.
      }),
    })
  }

  async toggleMutuelle(appointmentId: number): Promise<ApiResponse<{ mutuelle: number | boolean }>> {
    return this.request("/appointments/toggle-mutuelle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointment_id: appointmentId,
      }),
    })
  }

  async updateAppointmentDetails(
    appointmentId: number,
    details: {
      case_description?: string
      weight?: number
      pulse?: number
      temperature?: number
      blood_pressure?: string
      tall?: number
      spo2?: null
      DDR?: string
      notes?: string
      medicaments?: Array<{
        ID_Medicament: number
        dosage?: string
        frequence?: string
        duree?: string
      }>
      analyses?: Array<{
        ID_Analyse: number
      }>
    },
  ): Promise<ApiResponse<void>> {
    console.log("[v0] updateAppointmentDetails called with:", {
      appointmentId,
      details: JSON.stringify(details, null, 2),
    })

    return this.request(`/appointments/${appointmentId}/details`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(details),
    })
  }

  async getLastAppointmentInfo(appointmentId: number): Promise<
    ApiResponse<{
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
    }>
  > {
    return this.request(`/appointments/${appointmentId}/last-info`)
  }

  async updatePrice(appointmentId: number, price: number, medicalActs?: string[]): Promise<ApiResponse<{ price: number; medical_acts?: string[] }>> {
    return this.request("/appointments/update-price", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointment_id: appointmentId,
        price,
        medical_acts: medicalActs,
      }),
    })
  }

  async getEditData(appointmentId: number): Promise<
    ApiResponse<{
      appointment: Appointment
      available_medicaments: Medicament[]
      available_analyses: Analysis[]
    }>
  > {
    const url = `${this.baseURL}/appointments/${appointmentId}/edit-data`
    requestCache.delete(url)
    return this.request(`/appointments/${appointmentId}/edit-data`)
  }

  async createAppointment(appointmentData: {
    patient_id: number
    type: "Consultation" | "Control"
    appointment_date: string
    notes?: string
  }): Promise<ApiResponse<Appointment>> {
    return this.request("/appointments/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appointmentData),
    })
  }

  async createAppointmentFull(appointmentData: {
    patient_id: number
    appointment_type: "consultation" | "controle"
    appointment_date_hidden: string
    patient_notes?: string
  }): Promise<ApiResponse<Appointment>> {
    return this.request("/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appointmentData),
    })
  }

  async addControlAppointment(patientId: number): Promise<ApiResponse<Appointment>> {
    return this.request(`/appointments/${patientId}/add-control`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  // Search endpoints
  async searchPatients(term: string): Promise<ApiResponse<Patient[]>> {
    return this.request(`/patients/search?term=${encodeURIComponent(term)}`)
  }

  async searchMedicaments(query: string, showArchived = false): Promise<ApiResponse<Medicament[]>> {
    const params = new URLSearchParams()
    params.append("term", query)
    if (showArchived) params.append("archived", "true")

    const endpoint = `/medicaments/search?${params.toString()}`
    console.log("[v0] Calling searchMedicaments endpoint:", endpoint)

    const response = await this.request<{ success: boolean; data: Medicament[] }>(endpoint)

    // Transform the response to extract the data array
    if (response.success && response.data) {
      return {
        success: true,
        data: (response.data.data || response.data) as Medicament[],
        message: response.message
      }
    }

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: []
    } as ApiResponse<Medicament[]>
  }

  async searchAnalyses(query: string, showArchived = false): Promise<ApiResponse<Analysis[]>> {
    const params = new URLSearchParams()
    params.append("term", query)
    if (showArchived) params.append("archived", "true")

    const endpoint = `/analyses/search?${params.toString()}`
    console.log("[v0] Calling searchAnalyses endpoint:", endpoint)

    const response = await this.request<{ success: boolean; data: Analysis[] }>(endpoint)

    // Transform the response to extract the data array
    if (response.success && response.data) {
      return {
        success: true,
        data: (response.data.data || response.data) as Analysis[],
      }
    }

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: [] // Return empty array on error/empty to match expected type or handle gracefully
    } as ApiResponse<Analysis[]>
  }

  // PDF generation endpoints
  generateOrdonnancePDF(appointmentId: number): string {
    return `${this.baseURL}/appointments/${appointmentId}/ordonnance`
  }

  generateAnalysisPDF(appointmentId: number): string {
    return `${this.baseURL}/appointments/${appointmentId}/analysis-pdf`
  }

  generateCertificatePDF(certificateId: number): string {
    // The backend returns certificate data which can be printed
    return `${this.baseURL}/certificates/${certificateId}`
  }

  // Certificate management endpoints
  async getCertificates(patientId: number): Promise<
    ApiResponse<
      Array<{
        id: number
        ID_CM?: number
        start_date: string
        end_date: string
        content: string
        ID_patient?: number
      }>
    >
  > {
    return this.request(`/certificates/patient/${patientId}`)
  }

  async getCertificate(certificateId: number): Promise<
    ApiResponse<{
      id: number
      ID_CM?: number
      start_date: string
      end_date: string
      content: string
      ID_patient: number
    }>
  > {
    return this.request(`/certificates/${certificateId}`)
  }

  async createCertificate(
    patientId: number,
    certificateData: {
      start_date: string
      end_date: string
      content: string
    },
  ): Promise<
    ApiResponse<{
      id: number
      ID_CM?: number
      start_date: string
      end_date: string
      content: string
      ID_patient: number
    }>
  > {
    return this.request("/certificates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...certificateData,
        ID_patient: patientId,
      }),
    })
  }

  async deleteCertificate(certificateId: number): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/certificates/${certificateId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  // Patient management endpoints
  async getPatients(showArchived = false, page = 1, perPage = 10): Promise<ApiResponse<any>> {
    const params = new URLSearchParams()
    if (showArchived) params.append("archived", "true")
    params.append("page", page.toString())
    params.append("per_page", perPage.toString())

    const endpoint = `/patients?${params.toString()}`
    console.log("[v0] Calling getPatients endpoint:", endpoint)

    const response = await this.request(endpoint)
    console.log("[v0] getPatients raw response:", response)

    return response
  }

  async getPatient(id: number): Promise<ApiResponse<Patient>> {
    return this.request(`/patients/${id}`)
  }

  async createPatient(patientData: {
    first_name: string
    last_name: string
    birth_day: string
    gender: "Male" | "Female"
    CIN: string
    phone_num: string
    email?: string
    mutuelle?: string
    allergies?: string
    chronic_conditions?: string
    notes?: string
  }): Promise<ApiResponse<Patient>> {
    console.log("[v0] createPatient - data being sent:", {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      birth_day: patientData.birth_day,
      gender: patientData.gender,
      CIN: patientData.CIN,
      phone_num: patientData.phone_num,
    })

    const requestBody = {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      birth_day: patientData.birth_day,
      gender: patientData.gender,
      CIN: patientData.CIN,
      phone_num: patientData.phone_num,
      email: patientData.email || null,
      mutuelle: patientData.mutuelle === 'AUTRE' && (patientData as any).autre_mutuelle
        ? (patientData as any).autre_mutuelle
        : (patientData.mutuelle || null),
      allergies: patientData.allergies || null,
      chronic_conditions: patientData.chronic_conditions || null,
      notes: patientData.notes || null,
    }

    console.log("[v0] createPatient - full request body:", JSON.stringify(requestBody, null, 2))

    const response = this.request<Patient>("/patients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    console.log("[v0] createPatient - response promise created")
    return response
  }

  async updatePatient(
    id: number,
    patientData: {
      first_name: string
      last_name: string
      birth_day: string
      gender: "Male" | "Female"
      CIN: string
      phone_num: string
      email?: string
      mutuelle?: string
      allergies?: string
      chronic_conditions?: string
      notes?: string
    },
  ): Promise<ApiResponse<Patient>> {
    return this.request(`/patients/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patientData),
    })
  }

  async archivePatient(
    id: number,
    archived: boolean,
    fromArchived = false,
  ): Promise<
    ApiResponse<{
      success: boolean
      archived: boolean
      message: string
      redirect: string
    }>
  > {
    return this.request(`/patients/${id}/archive`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        archived,
        fromArchived,
      }),
    })
  }

  async searchPatientsDetailed(
    term: string,
    showArchived = false,
  ): Promise<
    ApiResponse<
      Array<{
        id: number
        name: string
        cin: string
        phone: string
        email?: string
        gender: string
        age?: number
        last_visit?: string
        next_visit?: string
        archived: boolean
        birth_day: string
      }>
    >
  > {
    const params = new URLSearchParams()
    params.append("term", term)
    if (showArchived) params.append("archived", "true")

    const endpoint = `/patients/search?${params.toString()}`
    console.log("[v0] Calling searchPatientsDetailed endpoint:", endpoint)

    const response = await this.request(endpoint)
    console.log("[v0] searchPatientsDetailed raw response:", response)

    return response
  }

  // Medicament management endpoints
  async getMedicaments(showArchived = false): Promise<ApiResponse<Medicament[]>> {
    const params = new URLSearchParams()
    if (showArchived) params.append("archived", "true")

    const endpoint = `/medicaments?${params.toString()}`
    console.log("[v0] Calling getMedicaments endpoint:", endpoint)

    const cacheKey = `${this.baseURL}${endpoint}`
    requestCache.delete(cacheKey)

    const response = await this.request<{ success: boolean; data: Medicament[] }>(endpoint)

    console.log("[v0] getMedicaments raw response:", JSON.stringify(response, null, 2))

    // Transform the response to extract the data array
    if (response.success && response.data) {
      const extractedData = response.data.data || response.data
      console.log("[v0] getMedicaments extracted data:", extractedData)
      return {
        success: true,
        data: extractedData as Medicament[],
      }
    }

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: []
    } as ApiResponse<Medicament[]>
  }

  async createMedicament(medicamentData: {
    name: string
    description?: string
    price: number
    dosage?: string
    composition?: string
  }): Promise<ApiResponse<Medicament>> {
    return this.request("/medicaments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(medicamentData),
    })
  }

  async updateMedicament(
    id: number,
    medicamentData: {
      name: string
      description?: string
      price: number
      dosage?: string
      composition?: string
    },
  ): Promise<ApiResponse<Medicament>> {
    return this.request(`/medicaments/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(medicamentData),
    })
  }

  async archiveMedicament(id: number, archived?: boolean): Promise<ApiResponse<Medicament>> {
    if (archived !== undefined) {
      // Toggle to specific state
      return this.request(`/medicaments/${id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived }),
      })
    } else {
      // Just archive (original behavior)
      return this.request(`/medicaments/${id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      })
    }
  }

  async restoreMedicament(id: number): Promise<ApiResponse<Medicament>> {
    return this.request(`/medicaments/${id}/restore`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  // Analysis management endpoints
  async getAnalyses(showArchived = false, page = 1): Promise<ApiResponse<any>> {
    const params = new URLSearchParams()
    if (showArchived) params.append("archived", "1")
    if (page > 1) params.append("page", page.toString())

    const endpoint = `/analyses?${params.toString()}`
    console.log("[v0] Calling getAnalyses endpoint:", endpoint)

    const cacheKey = `${this.baseURL}${endpoint}`
    requestCache.delete(cacheKey)

    const response = await this.request<any>(endpoint)

    console.log("[v0] getAnalyses raw response:", JSON.stringify(response, null, 2))

    if (response.success && response.data) {
      // Check for Laravel pagination structure
      // response.data.data refers to the 'data' property of the JSON response, which is the paginator object
      const paginator = response.data.data

      // The actual items are inside the 'data' property of the paginator object
      if (paginator && paginator.data && Array.isArray(paginator.data)) {
        return {
          success: true,
          data: paginator.data,
          meta: {
            current_page: paginator.current_page,
            last_page: paginator.last_page,
            total: paginator.total,
            per_page: paginator.per_page
          }
        } as any
      }

      const extractedData = response.data.data || response.data
      console.log("[v0] getAnalyses extracted data:", extractedData)
      return {
        success: true,
        data: extractedData,
        meta: {
          current_page: 1,
          last_page: 1,
          total: Array.isArray(extractedData) ? extractedData.length : 0,
          per_page: 15
        }
      } as any
    }

    return {
      success: response.success,
      message: response.message,
      error: response.error,
      data: [],
      meta: { current_page: 1, last_page: 1, total: 0 }
    } as any
  }

  async createAnalysis(analysisData: {
    type_analyse: string
    departement: string
  }): Promise<ApiResponse<Analysis>> {
    return this.request("/analyses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analysisData),
    })
  }

  async updateAnalysis(
    id: number,
    analysisData: {
      type_analyse: string
      departement: string
    },
  ): Promise<ApiResponse<Analysis>> {
    return this.request(`/analyses/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analysisData),
    })
  }

  // Profile management
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.request("/user")
  }

  async updateProfile(profileData: Partial<UserProfile>): Promise<ApiResponse<{ user: UserProfile; message: string }>> {
    return this.request("/user/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileData),
    })
  }

  async archiveAnalysis(id: number, archived?: boolean): Promise<ApiResponse<Analysis>> {
    if (archived !== undefined) {
      // Toggle to specific state
      return this.request(`/analyses/${id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived }),
      })
    } else {
      // Just archive (original behavior)
      return this.request(`/analyses/${id}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      })
    }
  }

  async restoreAnalysis(id: number): Promise<ApiResponse<Analysis>> {
    return this.request(`/analyses/${id}/restore`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  // Medecin dashboard endpoints
  async getMedecinDashboard(skipCache = false): Promise<
    ApiResponse<{
      totalPatients: number
      todayPatients: number
      activeAppointments: number
      currentPatient: Appointment | null
      waitingPatients: Appointment[]
      preparingPatients: Appointment[]
      completedPatients: Appointment[]
      upcomingAppointments: Appointment[]
      statusCounts: {
        waiting: number
        preparing: number
        consulting: number
        completed: number
      }
    }>
  > {
    const response = await this.request("/medecin/dashboard", {}, skipCache) // cache controlled by param
    console.log("[v0] getMedecinDashboard raw response:", JSON.stringify(response, null, 2))

    // Laravel might return data directly or wrapped in a data property
    if (response.success && response.data) {
      const rawData = response.data as any
      console.log("[v0] Raw data keys:", Object.keys(rawData))
      console.log("[v0] Raw data:", JSON.stringify(rawData, null, 2))

      // Return the data as-is, let the component handle the structure
      return response as any
    }

    return response as any
  }

  async updateMedecinStatus(appointmentId: number, status: string): Promise<ApiResponse<{ status: string }>> {
    return this.request("/medecin/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointment_id: appointmentId,
        status,
      }),
    })
  }

  async navigatePatient(direction: "next" | "previous"): Promise<ApiResponse<{ appointment: Appointment | null }>> {
    return this.request("/medecin/navigate-patient", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direction,
      }),
    })
  }

  async returnToConsultation(appointmentId: number): Promise<ApiResponse<{ appointment: Appointment }>> {
    return this.request("/medecin/return-to-consultation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointment_id: appointmentId,
      }),
    })
  }

  async getMedecinAppointmentsByDate(date: string): Promise<ApiResponse<Appointment[]>> {
    return this.request(`/medecin/appointments/${date}`)
  }

  async updateAppointment(
    appointmentId: number,
    appointmentData: {
      appointment_date?: string
      type?: string
      notes?: string
      status?: string
    },
  ): Promise<ApiResponse<Appointment>> {
    return this.request(`/appointments/${appointmentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appointmentData),
    })
  }

  async deleteAppointment(appointmentId: number): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/appointments/${appointmentId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  async getLastMedicamentsByPatient(patientId: number): Promise<
    ApiResponse<{
      date: string
      medicaments: Array<{
        id: number
        name: string
        dosage: string
        frequence: string
        duree: string
      }>
    }>
  > {
    return this.request(`/patients/${patientId}/last-medicaments`)
  }

  async getDoctorStats(): Promise<ApiResponse<any>> {
    return this.request("/medecin/statistics")
  }

  async getStatsRange(): Promise<ApiResponse<{ min_year: number; max_year: number }>> {
    return this.request("/medecin/statistics/range")
  }

  async getChartData(view: 'year' | 'month', target: string): Promise<ApiResponse<Array<{ date: string; count: number; revenue: number }>>> {
    const params = new URLSearchParams()
    params.append("view", view)
    params.append("target", target)
    return this.request(`/medecin/statistics/chart-data?${params.toString()}`)
  }

  // Settings endpoints
  async getUserSettings(): Promise<ApiResponse<any>> {
    return this.request("/settings", {}, true) // always skip cache for settings
  }

  async updateUserSettings(settings: any): Promise<ApiResponse<any>> {
    // Bust cache before sending so the next GET returns fresh data
    const url = `${this.baseURL}/settings`
    requestCache.delete(url)
    return this.request("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
  }

  // User management endpoints (Admin only)
  async getUsers(): Promise<ApiResponse<any>> {
    return this.request("/users")
  }

  async createUser(userData: any): Promise<ApiResponse<any>> {
    return this.request("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    })
  }

  async updateUser(id: number, userData: any): Promise<ApiResponse<any>> {
    return this.request(`/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(id: number): Promise<ApiResponse<any>> {
    return this.request(`/users/${id}`, {
      method: "DELETE",
    })
  }

  async updateUserPermissions(id: number, permissions: string[]): Promise<ApiResponse<any>> {
    return this.request(`/users/${id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    })
  }

  // Patient Documents
  async getPatientDocuments(patientId: number): Promise<ApiResponse<PatientDocument[]>> {
    const res = await this.request<any>(`/patients/${patientId}/documents`)
    if (res.success && res.data && res.data.data) {
      return { success: true, data: res.data.data }
    }
    return res as ApiResponse<PatientDocument[]>
  }

  async uploadPatientDocument(patientId: number, file: File, documentType?: string): Promise<ApiResponse<PatientDocument>> {
    const formData = new FormData()
    formData.append("file", file)
    if (documentType) {
      formData.append("document_type", documentType)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/patients/${patientId}/documents`, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Failed to upload document")
      }

      // Extract the document from the data field if it's there
      return {
        success: true,
        data: data.data || data,
        message: data.message,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      }
    }
  }

  async downloadPatientDocument(patientId: number, documentId: number): Promise<void> {
    const url = `${API_BASE_URL}/patients/${patientId}/documents/${documentId}/download`
    window.open(url, "_blank")
  }

  async deletePatientDocument(patientId: number, documentId: number): Promise<ApiResponse<void>> {
    const res = await this.request<any>(`/patients/${patientId}/documents/${documentId}`, {
      method: "DELETE"
    })
    return {
      success: res.success,
      message: res.message || (res.data && res.data.message),
    }
  }

  // ── Google Drive / Backup ──────────────────────────────────────────────────
  getGoogleOAuthUrl(userId: number): string {
    return `http://127.0.0.1:8000/auth/google?user_id=${userId}`
  }

  async listBackups(): Promise<ApiResponse<any>> {
    return this.request("/backup/list")
  }

  async createBackup(password: string): Promise<ApiResponse<any>> {
    return this.request("/backup/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
  }

  async restoreBackup(driveFileId: string, password: string): Promise<ApiResponse<any>> {
    return this.request("/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drive_file_id: driveFileId, password }),
    })
  }

  async deleteBackup(driveFileId: string): Promise<ApiResponse<any>> {
    return this.request(`/backup/${driveFileId}`, { method: "DELETE" })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)