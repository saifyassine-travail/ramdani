const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.4:8000/api"

export interface MedecinDashboardData {
  currentPatient?: {
    id: number
    name: string
    status: string
    appointmentId: number
  }
  todayStats: {
    total: number
    completed: number
    waiting: number
    consulting: number
  }
  nextAppointments: Array<{
    id: number
    patientName: string
    time: string
    type: string
  }>
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

class MedecinApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`
      console.log("[v0] Medecin API Request URL:", url)

      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers,
        },
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
      return {
        success: true,
        data: data as T,
      }
    } catch (error) {
      return {
        success: false,
        message: "Network error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async getDashboard(): Promise<ApiResponse<MedecinDashboardData>> {
    return this.request("/medecin/dashboard")
  }

  async updateStatus(appointmentId: number, status: string): Promise<ApiResponse<any>> {
    return this.request("/medecin/update-status", {
      method: "POST",
      body: JSON.stringify({
        appointment_id: appointmentId,
        status,
      }),
    })
  }

  async navigatePatient(direction: "next" | "previous"): Promise<ApiResponse<any>> {
    return this.request("/medecin/navigate-patient", {
      method: "POST",
      body: JSON.stringify({ direction }),
    })
  }

  async returnToConsultation(appointmentId: number): Promise<ApiResponse<any>> {
    return this.request("/medecin/return-to-consultation", {
      method: "POST",
      body: JSON.stringify({ appointment_id: appointmentId }),
    })
  }

  async getAppointmentsByDate(date: string): Promise<ApiResponse<any>> {
    return this.request(`/medecin/appointments/${date}`)
  }
}

export const medecinApiClient = new MedecinApiClient(API_BASE_URL)
