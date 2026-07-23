const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.3:8000/api"

export interface User {
  id: number
  name: string
  email: string
  role?: string
  permissions?: string | string[]
  created_at?: string
  updated_at?: string
}

export interface AuthResponse {
  success: boolean
  message?: string
  user?: User
  error?: string
  errors?: Record<string, string[]>
}

const TOKEN_KEY = "auth_token"

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

function saveAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

class AuthApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private authHeaders(): Record<string, string> {
    const token = getAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async getSetupStatus(): Promise<{ needsSetup: boolean }> {
    try {
      const response = await fetch(`${this.baseURL}/setup/status`, {
        headers: { Accept: "application/json" },
      })
      if (!response.ok) return { needsSetup: false }
      const data = await response.json()
      return { needsSetup: Boolean(data.needsSetup) }
    } catch {
      return { needsSetup: false }
    }
  }

  async createAdmin(name: string, email: string, password: string, passwordConfirmation: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/setup/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || "Impossible de créer le compte administrateur.",
          error: data.error,
          errors: data.errors,
        }
      }

      if (data.token) {
        saveAuthToken(data.token)
      }

      return {
        success: true,
        user: data.user,
      }
    } catch (error) {
      console.error("Create admin error:", error)
      return {
        success: false,
        message: "Erreur réseau. Veuillez réessayer.",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || "Login failed",
          error: data.error,
        }
      }

      if (data.token) {
        saveAuthToken(data.token)
      }

      return {
        success: true,
        user: data.user,
      }
    } catch (error) {
      console.error("[v0] Login network error:", error)
      return {
        success: false,
        message: "Erreur réseau. Veuillez réessayer.",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async logout(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...this.authHeaders(),
        },
      })

      clearAuthToken()

      const data = await response.json()

      return {
        success: true,
        message: data.message,
      }
    } catch (error) {
      clearAuthToken()
      return {
        success: false,
        message: "Erreur réseau. Veuillez réessayer.",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async getUser(): Promise<AuthResponse> {
    try {
      const token = getAuthToken()
      if (!token) {
        return { success: false, message: "Not authenticated" }
      }

      const response = await fetch(`${this.baseURL}/user`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        clearAuthToken()
        return {
          success: false,
          message: "Not authenticated",
        }
      }

      const user = await response.json()

      return {
        success: true,
        user,
      }
    } catch (error) {
      return {
        success: false,
        message: "Erreur réseau. Veuillez réessayer.",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

export const authApiClient = new AuthApiClient(AUTH_API_BASE_URL)