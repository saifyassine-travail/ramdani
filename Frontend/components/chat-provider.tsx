"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { chatApi, type ChatMessage, type ChatUser, type Conversation } from "@/lib/chat-api"
import { ChatContext } from "@/hooks/use-chat"

const CONV_POLL_MS = 10_000
const MSG_POLL_MS  = 1_500

export function ChatProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen]             = useState(false)
  const [drawerView, setDrawerView]           = useState<"list" | "chat" | "new">("list")
  const [activePartnerId, setActivePartnerId] = useState<number | null>(null)
  const [activePartner, setActivePartner]     = useState<ChatUser | null>(null)
  const [conversations, setConversations]     = useState<Conversation[]>([])
  const [messages, setMessages]               = useState<ChatMessage[]>([])
  const [users, setUsers]                     = useState<ChatUser[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const unreadCount  = conversations.reduce((sum, c) => sum + c.unread_count, 0)
  const msgTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const partnerRef   = useRef<number | null>(null)

  // ─── loaders ────────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await chatApi.getConversations()
      if (res.success && res.data) setConversations(res.data)
    } catch {}
  }, [])

  const loadMessages = useCallback(async (partnerId: number) => {
    try {
      const res = await chatApi.getMessages(partnerId)
      if (res.success && res.data) {
        // Keep any not-yet-confirmed optimistic messages (negative id) that a
        // concurrent send may have added — a blind overwrite here would wipe
        // them out mid-flight and make just-sent messages appear to vanish.
        const fetched = res.data
        setMessages((prev) => {
          const pendingOptimistic = prev.filter(
            (m) => m.id < 0 && !fetched.some((f) => f.body === m.body && f.is_mine),
          )
          return [...fetched, ...pendingOptimistic]
        })
        setConversations((prev) =>
          prev.map((c) => (c.partner.id === partnerId ? { ...c, unread_count: 0 } : c)),
        )
      }
    } catch {}
  }, [])

  // ─── background poll (unread badge) ─────────────────────────────────────────

  useEffect(() => {
    loadConversations()
    const timer = setInterval(loadConversations, CONV_POLL_MS)
    return () => clearInterval(timer)
  }, [loadConversations])

  // ─── message poll when chat is open ─────────────────────────────────────────

  useEffect(() => {
    partnerRef.current = activePartnerId
    if (drawerView === "chat" && activePartnerId !== null) {
      if (msgTimerRef.current) clearInterval(msgTimerRef.current)
      msgTimerRef.current = setInterval(() => {
        if (partnerRef.current !== null) loadMessages(partnerRef.current)
      }, MSG_POLL_MS)
      return () => {
        if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null }
      }
    } else {
      if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null }
    }
  }, [drawerView, activePartnerId, loadMessages])

  // ─── panel ──────────────────────────────────────────────────────────────────

  const openPanel = useCallback(() => {
    setPanelOpen(true)
    setDrawerView("list")
    loadConversations()
  }, [loadConversations])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    setDrawerView("list")
    setActivePartnerId(null)
    setActivePartner(null)
    setMessages([])
    if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null }
  }, [])

  // ─── new chat picker ────────────────────────────────────────────────────────

  const openNewChat = useCallback(async () => {
    setDrawerView("new")
    try {
      const res = await chatApi.getUsers()
      if (res.success && res.data) setUsers(res.data)
    } catch {}
  }, [])

  // ─── conversation ────────────────────────────────────────────────────────────

  const openConversation = useCallback(async (partner: ChatUser) => {
    setActivePartnerId(partner.id)
    setActivePartner(partner)
    setDrawerView("chat")
    setLoadingMessages(true)
    await loadMessages(partner.id)
    setLoadingMessages(false)
  }, [loadMessages])

  const backToList = useCallback(() => {
    setDrawerView("list")
    setActivePartnerId(null)
    setActivePartner(null)
    setMessages([])
    if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null }
  }, [])

  // ─── actions ─────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (body: string) => {
    if (!activePartnerId || !body.trim()) return
    const trimmed = body.trim()

    // Optimistic: show immediately before server responds
    const tempId = -Date.now()
    const now = new Date().toISOString()
    const tempMsg: ChatMessage = {
      id: tempId,
      body: trimmed,
      sender_id: -1,
      receiver_id: activePartnerId,
      is_mine: true,
      read_at: null,
      created_at: now,
    }
    setMessages((prev) => [...prev, tempMsg])

    const res = await chatApi.sendMessage(activePartnerId, trimmed)
    if (res.success && res.data) {
      const msg = res.data
      // Replace optimistic placeholder with real message from server. A poll may have
      // already fetched this same message (racing the POST response) — drop any
      // pre-existing copy by id so it isn't duplicated.
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId && m.id !== msg.id), msg])
      setConversations((prev) => {
        const exists = prev.find((c) => c.partner.id === activePartnerId)
        const updated = exists
          ? prev.map((c) =>
              c.partner.id !== activePartnerId
                ? c
                : { ...c, last_message: { body: msg.body, created_at: msg.created_at, is_mine: true } },
            )
          : activePartner
          ? [
              {
                partner: activePartner,
                last_message: { body: msg.body, created_at: msg.created_at, is_mine: true },
                unread_count: 0,
              },
              ...prev,
            ]
          : prev
        return updated.sort((a, b) => {
          const ta = a.last_message?.created_at ?? ""
          const tb = b.last_message?.created_at ?? ""
          return tb > ta ? 1 : -1
        })
      })
    } else {
      // Remove placeholder if send failed
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    }
  }, [activePartnerId, activePartner])

  const deleteMessage = useCallback(async (messageId: number, scope: "me" | "everyone") => {
    const res = await chatApi.deleteMessage(messageId, scope)
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, body: null, is_deleted: true } : m)),
      )
    }
  }, [])

  const deleteConversation = useCallback(async (partnerId: number) => {
    const res = await chatApi.deleteConversation(partnerId)
    if (res.success) {
      setConversations((prev) => prev.filter((c) => c.partner.id !== partnerId))
      if (partnerRef.current === partnerId) {
        setDrawerView("list")
        setActivePartnerId(null)
        setActivePartner(null)
        setMessages([])
        if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null }
      }
    }
  }, [])

  return (
    <ChatContext.Provider
      value={{
        panelOpen, openPanel, closePanel,
        drawerView, activePartnerId, activePartner,
        conversations, messages, users, unreadCount, loadingMessages,
        openConversation, backToList, openNewChat,
        sendMessage, deleteMessage, deleteConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
