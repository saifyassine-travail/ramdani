"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { useAuth } from "@/hooks/use-auth"
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  Pill,
  FlaskConical,
  BarChart3,
  Settings,
  LogOut,
  Menu
} from "lucide-react"

// Custom Logo Component (Kept as requested, it's the specific branding)
const MediAssistLogo = () => (
  <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 90C50 90 85 70 95 45C95 30 85 20 70 20C60 20 54 25 50 30C46 25 40 20 30 20C15 20 5 30 5 45C5 70 40 90 50 90Z" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M50 90V45" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    <path d="M30 50H70" stroke="white" strokeWidth="6" strokeLinecap="round" />
    <path d="M50 30V70" stroke="white" strokeWidth="6" strokeLinecap="round" />
    <circle cx="75" cy="25" r="5" fill="white" fillOpacity="0.8" />
    <circle cx="85" cy="35" r="3" fill="white" fillOpacity="0.6" />
  </svg>
)

interface MedicalSidebarProps {
  currentPage: string
  user: {
    name: string
    role: string
    avatar?: string
    permissions?: string[]
  }
}

export default function MedicalSidebar({ currentPage, user }: MedicalSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { logout } = useAuth()

  const hasPermission = (routeId: string) => {
    if (user.role === "admin") return true
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(routeId)
    }
    return false // Default to false if no permissions defined and not admin
  }

  const menuItems = [
    {
      id: "dashboard",
      label: "Tableau de Bord",
      icon: <LayoutDashboard size={20} />,
      href: "/",
      show: user.role === "admin" || hasPermission("dashboard"),
    },
    {
      id: "medecin",
      label: "Espace Médecin",
      icon: <Stethoscope size={20} />,
      href: "/medecin",
      show: user.role === "admin" || hasPermission("medecin"),
    },
    {
      id: "patients",
      label: "Patients",
      icon: <Users size={20} />,
      href: "/patients",
      show: user.role === "admin" || hasPermission("patients"),
    },
    {
      id: "medicaments",
      label: "Médicaments",
      icon: <Pill size={20} />,
      href: "/medicaments",
      show: user.role === "admin" || hasPermission("medicaments"),
    },
    {
      id: "analyses",
      label: "Analyses",
      icon: <FlaskConical size={20} />,
      href: "/analyses",
      show: user.role === "admin" || hasPermission("analyses"),
    },
    {
      id: "statistics",
      label: "Statistiques",
      icon: <BarChart3 size={20} />,
      href: "/medecin/statistics",
      show: user.role === "admin" || hasPermission("statistics"),
    },
    {
      id: "settings",
      label: "Paramètres",
      icon: <Settings size={20} />,
      href: "/settings",
      show: user.role === "admin" || hasPermission("settings"),
    },
  ]

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <div
      className="w-64 h-screen fixed top-0 left-0 shadow-2xl flex flex-col transition-all duration-300 z-50 overflow-hidden font-sans border-r border-white/10"
      style={{ background: "linear-gradient(180deg, #007090 0%, #005570 100%)" }}
    >
      {/* Logo Section */}
      <div className="flex items-center gap-4 py-6 px-6">
        <div className="flex-shrink-0">
          <MediAssistLogo />
        </div>
        <div className="flex flex-col overflow-hidden whitespace-nowrap">
          <h2 className="text-xl font-bold tracking-tight text-white leading-none">MediAssist</h2>
          <span className="text-[10px] text-blue-100 uppercase tracking-wider mt-1 opacity-80">Medical Pro</span>
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="h-[1px] bg-white/10 w-full"></div>
      </div>

      {/* Navigation Links */}
      <div className="flex-grow overflow-y-auto px-3 space-y-2">
        {menuItems
          .filter((item) => item.show)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all duration-200 group relative overflow-hidden ${isActiveRoute(item.href)
                ? "bg-white/15 text-white shadow-lg"
                : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
            >
              {isActiveRoute(item.href) && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>
              )}
              <div className={`flex items-center justify-center transition-colors ${isActiveRoute(item.href) ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                {item.icon}
              </div>
              <span className="text-sm font-medium tracking-wide truncate">{item.label}</span>
              {isActiveRoute(item.href) && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-300 shadow-glow"></div>}
            </button>
          ))}
      </div>

      {/* Footer / Logout */}
      <div className="p-4 bg-[#004555]/30 backdrop-blur-sm border-t border-white/5 mt-auto">
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-2 rounded-lg text-red-200 hover:text-red-100 hover:bg-red-500/20 transition-all duration-200 group"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>
    </div>
  )
}
