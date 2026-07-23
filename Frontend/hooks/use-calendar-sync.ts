"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getSyncManager, type SyncEvent } from "../lib/realtime-sync"

export interface SyncedCalendarState {
  currentDate: Date
  selectedDate: string | null
  connectedUsers: number
  lastSyncEvent: SyncEvent | null
}

export function useCalendarSync() {
  const syncManager = useRef(getSyncManager())
  const [syncState, setSyncState] = useState<SyncedCalendarState>({
    currentDate: new Date(),
    selectedDate: null,
    connectedUsers: 1,
    lastSyncEvent: null,
  })

  // Handle incoming sync events
  const handleSyncEvent = useCallback((event: SyncEvent) => {
    setSyncState((prev) => {
      const newState = { ...prev, lastSyncEvent: event }

      // Update state based on event type
      if (event.type === "DATE_SELECTED") {
        newState.selectedDate = event.date
      } else if (event.type === "MONTH_NAVIGATED") {
        newState.currentDate = new Date(event.date)
      } else if (event.type === "USER_JOINED") {
        newState.connectedUsers = prev.connectedUsers + 1
        syncManager.current.addConnectedUser(event.userId)
      } else if (event.type === "USER_LEFT") {
        newState.connectedUsers = Math.max(1, prev.connectedUsers - 1)
        syncManager.current.removeConnectedUser(event.userId)
      }

      return newState
    })
  }, [])

  // Subscribe to sync events on mount
  useEffect(() => {
    const unsubscribe = syncManager.current.subscribe(handleSyncEvent)
    return unsubscribe
  }, [handleSyncEvent])

  // Broadcast date selection
  const broadcastDateSelect = useCallback((date: string) => {
    syncManager.current.selectDate(date)
    setSyncState((prev) => ({ ...prev, selectedDate: date }))
  }, [])

  // Broadcast month navigation
  const broadcastMonthNavigation = useCallback((direction: "prev" | "next") => {
    setSyncState((prev) => {
      const newDate = new Date(prev.currentDate)
      if (direction === "prev") {
        newDate.setMonth(prev.currentDate.getMonth() - 1)
      } else {
        newDate.setMonth(prev.currentDate.getMonth() + 1)
      }
      syncManager.current.navigateMonth(direction, newDate)
      return { ...prev, currentDate: newDate }
    })
  }, [])

  return {
    syncState,
    broadcastDateSelect,
    broadcastMonthNavigation,
    getSessionInfo: () => syncManager.current.getSessionInfo(),
  }
}
