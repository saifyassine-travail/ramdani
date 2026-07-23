"use client"

import { createContext, useState, useEffect, type ReactNode } from "react"
import { authApiClient, type User } from "@/lib/auth-api"

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async (retries = 3) => {
    setIsLoading(true)

    // Attempt to verify session with server first (HTTP-only cookie)
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await authApiClient.getUser()

        if (response.success && response.user) {
          setUser(response.user)
          // Backup to localStorage for basic offline UI preservation, but truth is always server
          localStorage.setItem("user", JSON.stringify(response.user))
          setIsLoading(false)
          return
        } else if (response.message?.includes("Unauthenticated") || response.message === "Not authenticated") {
          // Explicit failure from server means the cookie is invalid or missing.
          // Clear everything.
          setUser(null)
          localStorage.removeItem("user")
          setIsLoading(false)
          return
        }
      } catch (error) {
        console.error(`[v0] Auth check attempt ${attempt + 1} failed (Network/Other):`, error)
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    // If all retries failed (due to NETWORK errors, not auth errors), try to restore from localStorage
    // This allows for "offline mode" or resilience against temporary network blips
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUser(user)
      } catch (error) {
        console.error("[v0] Failed to restore user from localStorage:", error)
        setUser(null)
        localStorage.removeItem("user")
      }
    } else {
      setUser(null)
    }

    setIsLoading(false)
  }

  const login = async (email: string, password: string) => {
    const response = await authApiClient.login(email, password)
    if (response.success && response.user) {
      setUser(response.user)
      // Store user in localStorage
      localStorage.setItem("user", JSON.stringify(response.user))
      return { success: true }
    }
    return { success: false, message: response.message }
  }

  const logout = async () => {
    // Clear local state immediately for UI responsiveness
    setUser(null)
    localStorage.removeItem("user")

    // Then attempt server-side logout
    try {
      await authApiClient.logout()
    } catch (error) {
      console.error("Logout API call failed:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
