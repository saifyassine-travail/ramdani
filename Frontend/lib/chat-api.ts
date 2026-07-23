import { getAuthToken } from "@/lib/auth-api"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function req<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...((init.headers as Record<string, string>) || {}) },
    })
    return await res.json()
  } catch {
    return { success: false, message: "Erreur réseau" }
  }
}

export interface ChatUser {
  id: number
  name: string
  role: string
}

export interface ChatMessage {
  id: number
  body: string | null
  sender_id: number
  receiver_id: number
  is_mine: boolean
  read_at: string | null
  created_at: string
  is_deleted?: boolean
}

export interface Conversation {
  partner: ChatUser
  last_message: { body: string | null; created_at: string; is_mine: boolean; is_deleted?: boolean } | null
  unread_count: number
}

export const chatApi = {
  getUsers: () => req<ChatUser[]>("/messages/users"),

  getConversations: () => req<Conversation[]>("/messages/conversations"),

  getMessages: (userId: number) => req<ChatMessage[]>(`/messages/${userId}`),

  sendMessage: (userId: number, body: string) =>
    req<ChatMessage>(`/messages/${userId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  deleteMessage: (messageId: number, scope: "me" | "everyone" = "me") =>
    req(`/messages/${messageId}`, { method: "DELETE", body: JSON.stringify({ scope }) }),

  deleteConversation: (partnerId: number) =>
    req(`/messages/conversation/${partnerId}`, { method: "DELETE" }),

  markRead: (userId: number) =>
    req(`/messages/${userId}/read`, { method: "PATCH" }),

  unreadCount: () => req<{ count: number }>("/messages/unread-count"),
}
