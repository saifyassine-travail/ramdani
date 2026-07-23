export type SyncEvent =
  | { type: "DATE_SELECTED"; date: string; userId: string }
  | { type: "MONTH_NAVIGATED"; date: Date; direction: "prev" | "next"; userId: string }
  | { type: "USER_JOINED"; userId: string; sessionId: string }
  | { type: "USER_LEFT"; userId: string }

export type SyncListener = (event: SyncEvent) => void

class RealtimeSyncManager {
  private listeners: Set<SyncListener> = new Set()
  private sessionId: string
  private userId: string
  private connectedUsers: Map<string, { joinedAt: number }> = new Map()

  constructor() {
    this.sessionId = this.generateSessionId()
    this.userId = this.generateUserId()
    this.initializeSession()
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateUserId(): string {
    // In a real app, this would come from authentication
    return `user-${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeSession(): void {
    // Store session info in localStorage for persistence
    if (typeof window !== "undefined") {
      const existingSession = localStorage.getItem("calendar-session-id")
      if (existingSession) {
        this.sessionId = existingSession
      } else {
        localStorage.setItem("calendar-session-id", this.sessionId)
      }

      const existingUserId = localStorage.getItem("calendar-user-id")
      if (existingUserId) {
        this.userId = existingUserId
      } else {
        localStorage.setItem("calendar-user-id", this.userId)
      }
    }

    // Broadcast user joined event
    this.broadcastEvent({
      type: "USER_JOINED",
      userId: this.userId,
      sessionId: this.sessionId,
    })
  }

  // Subscribe to sync events
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Broadcast an event to all listeners
  private broadcastEvent(event: SyncEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error("[v0] Error in sync listener:", error)
      }
    })
  }

  // Public methods for calendar actions
  selectDate(date: string): void {
    this.broadcastEvent({
      type: "DATE_SELECTED",
      date,
      userId: this.userId,
    })
  }

  navigateMonth(direction: "prev" | "next", date: Date): void {
    this.broadcastEvent({
      type: "MONTH_NAVIGATED",
      date,
      direction,
      userId: this.userId,
    })
  }

  // Get current session info
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      connectedUsers: Array.from(this.connectedUsers.keys()),
    }
  }

  // Track connected users
  addConnectedUser(userId: string): void {
    this.connectedUsers.set(userId, { joinedAt: Date.now() })
  }

  removeConnectedUser(userId: string): void {
    this.connectedUsers.delete(userId)
  }

  getConnectedUsersCount(): number {
    return this.connectedUsers.size
  }
}

// Singleton instance
let syncManager: RealtimeSyncManager | null = null

export function getSyncManager(): RealtimeSyncManager {
  if (!syncManager) {
    syncManager = new RealtimeSyncManager()
  }
  return syncManager
}

// Hook for using sync manager in components
export function useSyncManager() {
  return getSyncManager()
}
