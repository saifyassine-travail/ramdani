"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, CheckCheck, Calendar, Wallet, ShieldAlert, Database, Info } from "lucide-react"
import { Button } from "./ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { apiClient } from "../lib/api"
import { useAuth } from "@/hooks/use-auth"

interface AppNotification {
  id: number
  type: string
  level: "info" | "success" | "warning" | "error"
  title: string
  message?: string | null
  link?: string | null
  read_at?: string | null
  created_at: string
}

const POLL_MS = 60000

// Icon per notification type.
function typeIcon(type: string) {
  switch (type) {
    case "appointment":
      return Calendar
    case "credit":
      return Wallet
    case "account":
      return ShieldAlert
    case "backup":
      return Database
    default:
      return Info
  }
}

// Colour ring per severity level.
function levelClasses(level: string) {
  switch (level) {
    case "success":
      return "bg-green-100 text-green-600"
    case "warning":
      return "bg-amber-100 text-amber-600"
    case "error":
      return "bg-red-100 text-red-600"
    default:
      return "bg-blue-100 text-blue-600"
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ""
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export default function NotificationsBell() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await apiClient.getNotifications()
      const data = res.data as any
      if (res.success && data) {
        setItems(Array.isArray(data.notifications) ? data.notifications : [])
        setUnread(data.unread_count ?? 0)
      }
    } catch {
      /* silent — the bell must never break the header */
    }
  }, [isAdmin])

  // Poll while mounted (admins only).
  useEffect(() => {
    if (!isAdmin) return
    load()
    timerRef.current = setInterval(load, POLL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isAdmin, load])

  // Refresh immediately when the panel opens.
  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleOpenItem = async (n: AppNotification) => {
    if (!n.read_at) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)))
      setUnread((u) => Math.max(0, u - 1))
      apiClient.markNotificationRead(n.id).catch(() => {})
    }
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })))
    setUnread(0)
    apiClient.markAllNotificationsRead().catch(() => {})
  }

  if (!isAdmin) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-gray-800">Notifications</span>
            {unread > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{unread}</span>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout lire
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Aucune notification
            </div>
          ) : (
            items.map((n) => {
              const Icon = typeIcon(n.type)
              const unreadItem = !n.read_at
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenItem(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-gray-50 ${
                    unreadItem ? "bg-blue-50/40" : ""
                  }`}
                >
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${levelClasses(n.level)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${unreadItem ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {n.title}
                      </span>
                      {unreadItem && <span className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    {n.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
