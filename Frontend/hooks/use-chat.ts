import { createContext, useContext } from "react"
import type { ChatMessage, ChatUser, Conversation } from "@/lib/chat-api"

export interface ChatContextValue {
  panelOpen: boolean
  openPanel: () => void
  closePanel: () => void
  drawerView: "list" | "chat" | "new"
  activePartnerId: number | null
  activePartner: ChatUser | null
  conversations: Conversation[]
  messages: ChatMessage[]
  users: ChatUser[]
  unreadCount: number
  loadingMessages: boolean
  openConversation: (partner: ChatUser) => void
  backToList: () => void
  openNewChat: () => void
  sendMessage: (body: string) => Promise<void>
  deleteMessage: (messageId: number, scope: "me" | "everyone") => void
  deleteConversation: (partnerId: number) => Promise<void>
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used within ChatProvider")
  return ctx
}
