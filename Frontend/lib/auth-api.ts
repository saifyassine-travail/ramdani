const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.4:8000/api"

export interface User {
  id: number
  name: string
  email: string
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

class AuthApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  async getCsrfToken(): Promise<void> {
    try {
      console.log("[v0] Fetching CSRF token from:", `${this.baseURL.replace("/api", "")}/sanctum/csrf-cookie`)
      const response = await fetch(`${this.baseURL.replace("/api", "")}/sanctum/csrf-cookie`, {
        method: "GET",
        credentials: "include",
      })
      console.log("[v0] CSRF token response status:", response.status)
    } catch (error) {
      console.error("[v0] Failed to get CSRF token:", error)
    }
  }

  async register(name: string, email: string, password: string, passwordConfirmation: string): Promise<AuthResponse> {
    try {
      await this.getCsrfToken()

      console.log("[v0] Attempting registration with email:", email)
      const response = await fetch(`${this.baseURL}/register`, {
        method: "POST",
        credentials: "include",
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
      console.log("[v0] Register response status:", response.status)
      console.log("[v0] Register response data:", data)

      if (!response.ok) {
        return {
          success: false,
          message: data.message || "Registration failed",
          error: data.error,
          errors: data.errors,
        }
      }

      return {
        success: true,
        user: data.user,
      }
    } catch (error) {
      console.error("[v0] Register error:", error)
      return {
        success: false,
        message: "Network error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      await this.getCsrfToken()

      console.log("[v0] Attempting login with email:", email)
      const response = await fetch(`${this.baseURL}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      console.log("[v0] Login response status:", response.status)
      console.log("[v0] Login response headers:", {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
      })

      const data = await response.json()
      console.log("[v0] Login response data:", data)
      console.log("[v0] Full response object:", JSON.stringify(data, null, 2))

      if (!response.ok) {
        console.error("[v0] Login failed with status:", response.status, "Error:", data)
        return {
          success: false,
          message: data.message || "Login failed",
          error: data.error,
        }
      }

      return {
        success: true,
        user: data.user,
      }
    } catch (error) {
      console.error("[v0] Login network error:", error)
      return {
        success: false,
        message: "Network error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async logout(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          message: data.message || "Logout failed",
        }
      }

      return {
        success: true,
        message: data.message,
      }
    } catch (error) {
      return {
        success: false,
        message: "Network error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async getUser(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/user`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
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
        message: "Network error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

export const authApiClient = new AuthApiClient(AUTH_API_BASE_URL)
