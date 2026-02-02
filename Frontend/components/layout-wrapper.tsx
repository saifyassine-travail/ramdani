"use client"

import type React from "react"
import { useAuth } from "@/hooks/use-auth"
import MedicalHeader from "./medical-header"
import MedicalSidebar from "./medical-sidebar"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { GlobalSyncProvider } from "./global-sync-provider"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isAuthPage = pathname === "/login" || pathname === "/register"

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      router.push("/login")
    }
  }, [isLoading, isAuthenticated, isAuthPage, router])

  const defaultUser = {
    name: user?.name || "Dr. Sarah Johnson",
    role: user?.role || "admin",
    avatar: "/images/default-medcin.jpg",
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <GlobalSyncProvider>
        <div className="flex h-screen bg-gray-100">
          <MedicalSidebar currentPage="dashboard" user={defaultUser} />
          <div className="flex-1 flex flex-col pl-64 bg-blue-100">
            <MedicalHeader />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </GlobalSyncProvider>
    )
  }

  return <>{children}</>
}
