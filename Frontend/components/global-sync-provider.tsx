"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { globalSyncManager } from "@/lib/global-sync-manager"

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [connectedUsers, setConnectedUsers] = useState(1)
  const [syncStatus, setSyncStatus] = useState<"connected" | "syncing" | "idle">("idle")

  useEffect(() => {
    if (user?.id) {
      globalSyncManager.setUserId(user.id)
    }
  }, [user?.id])

  useEffect(() => {
    // Update connected users count periodically
    const interval = setInterval(() => {
      setConnectedUsers(globalSyncManager.getConnectedUsers())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Show sync indicator
  useEffect(() => {
    const handleSync = () => {
      setSyncStatus("syncing")
      const timer = setTimeout(() => setSyncStatus("connected"), 500)
      return () => clearTimeout(timer)
    }

    globalSyncManager.subscribe("user-action", () => {
      handleSync()
    })
  }, [])

  // The floating sync-status badge was removed at the user's request.
  return <>{children}</>
}
