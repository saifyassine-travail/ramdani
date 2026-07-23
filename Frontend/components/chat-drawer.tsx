"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useChat } from "@/hooks/use-chat"
import type { ChatMessage, ChatUser, Conversation } from "@/lib/chat-api"

// ─── helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function roleFr(role: string) {
  if (role === "admin") return "Médecin"
  if (role === "nurse") return "Infirmier(e)"
  return role
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ""
  const diff = Math.max(0, Date.now() - then)
  const min  = Math.floor(diff / 60_000)
  if (min < 1) return "maintenant"
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}j`
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function formatMsgDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Hier"
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs"
  return (
    <div className={`${sizeClass} rounded-full bg-rose-500 text-white flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials(name)}
    </div>
  )
}

// ─── ConversationItem ────────────────────────────────────────────────────────

function ConversationItem({
  conv,
  onOpen,
  onDelete,
}: {
  conv: Conversation
  onOpen: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
    >
      <Avatar name={conv.partner.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-gray-900 text-sm truncate">{conv.partner.name}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {conv.last_message && (
              <span className="text-[10px] text-gray-400">{timeAgo(conv.last_message.created_at)}</span>
            )}
            {hovered && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="p-0.5 rounded text-gray-400 hover:text-red-500 transition-colors"
                title="Supprimer la conversation"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-gray-500 truncate">
            {conv.last_message
              ? (conv.last_message.is_mine ? "Vous: " : "") +
                (conv.last_message.is_deleted ? "Ce message a été supprimé" : conv.last_message.body)
              : "Aucun message"}
          </p>
          {conv.unread_count > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#007090] text-white text-[10px] font-bold">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onRequestDelete,
  showDate,
  dateLabel,
}: {
  msg: ChatMessage
  onRequestDelete: () => void
  showDate: boolean
  dateLabel: string
}) {
  const [showDel, setShowDel] = useState(false)

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-2">
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{dateLabel}</span>
        </div>
      )}
      <div
        className={`flex ${msg.is_mine ? "justify-end" : "justify-start"} group mb-1`}
        onMouseEnter={() => setShowDel(true)}
        onMouseLeave={() => setShowDel(false)}
      >
        <div className="relative max-w-[75%]">
          <div
            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
              msg.is_deleted
                ? "bg-gray-100 text-gray-400 italic border border-gray-200 rounded-tl-sm rounded-tr-sm"
                : msg.is_mine
                ? "bg-[#007090] text-white rounded-tr-sm"
                : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm"
            }`}
          >
            {msg.is_deleted ? (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Ce message a été supprimé
              </span>
            ) : (
              msg.body
            )}
          </div>
          <div className={`flex items-center gap-1 mt-0.5 ${msg.is_mine ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-gray-400">{formatMsgTime(msg.created_at)}</span>
          </div>
          {showDel && !msg.is_deleted && (
            <button
              type="button"
              onClick={onRequestDelete}
              title="Supprimer"
              className={`absolute -top-1 ${msg.is_mine ? "-left-6" : "-right-6"} p-0.5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 shadow-sm transition-colors`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── DeleteMessageModal ──────────────────────────────────────────────────────

function DeleteMessageModal({
  isMine,
  onCancel,
  onConfirm,
}: {
  isMine: boolean
  onCancel: () => void
  onConfirm: (scope: "me" | "everyone") => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-6" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xs overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3">
          <h3 className="font-semibold text-gray-900 text-sm">Supprimer le message ?</h3>
          <p className="text-xs text-gray-500 mt-1">Choisissez pour qui ce message doit être supprimé.</p>
        </div>
        <div className="flex flex-col border-t border-gray-100">
          {isMine && (
            <button
              type="button"
              onClick={() => onConfirm("everyone")}
              className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left transition-colors border-b border-gray-100"
            >
              Supprimer pour tout le monde
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm("me")}
            className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left transition-colors border-b border-gray-100"
          >
            Supprimer pour moi
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 text-left transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DeleteConversationModal ─────────────────────────────────────────────────

function DeleteConversationModal({
  partnerName,
  onCancel,
  onConfirm,
}: {
  partnerName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-6" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xs overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3">
          <h3 className="font-semibold text-gray-900 text-sm">Supprimer la conversation avec {partnerName} ?</h3>
          <p className="text-xs text-gray-500 mt-1">
            Elle sera supprimée uniquement de votre côté ; {partnerName} la conservera.
          </p>
        </div>
        <div className="flex flex-col border-t border-gray-100">
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left transition-colors border-b border-gray-100"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 text-left transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChatDrawer ──────────────────────────────────────────────────────────────

export default function ChatDrawer() {
  const {
    panelOpen, closePanel,
    drawerView, activePartner,
    conversations, messages, users, loadingMessages,
    openConversation, backToList, openNewChat,
    sendMessage, deleteMessage, deleteConversation,
  } = useChat()

  const [input, setInput]           = useState("")
  const [search, setSearch]         = useState("")
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)
  const messagesEndRef              = useRef<HTMLDivElement>(null)
  const inputRef                    = useRef<HTMLTextAreaElement>(null)

  // auto-scroll messages to bottom
  useEffect(() => {
    if (drawerView === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, drawerView])

  // reset input when switching conversations
  useEffect(() => {
    setInput("")
  }, [activePartner])

  const handleSend = useCallback(async () => {
    if (!input.trim()) return
    const text = input
    setInput("")
    await sendMessage(text)
  }, [input, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // group messages by date for separators
  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((acc, msg) => {
    const label = formatMsgDate(msg.created_at)
    const last  = acc[acc.length - 1]
    if (last && last.date === label) {
      last.msgs.push(msg)
    } else {
      acc.push({ date: label, msgs: [msg] })
    }
    return acc
  }, [])

  const filteredConversations = conversations.filter((c) =>
    c.partner.name.toLowerCase().includes(search.toLowerCase()),
  )

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()),
  )

  if (!panelOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closePanel}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[380px] bg-white z-50 flex flex-col shadow-2xl">

        {/* ── List view ── */}
        {drawerView === "list" && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-[#007090]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-semibold text-gray-800">Messages</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={openNewChat}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#007090] transition-colors"
                  title="Nouvelle conversation"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher une conversation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-100 rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#007090]/30"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <svg className="h-12 w-12 text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm text-gray-400">Aucune conversation</p>
                  <button
                    type="button"
                    onClick={openNewChat}
                    className="mt-3 text-sm text-[#007090] hover:underline"
                  >
                    Démarrer une conversation
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <ConversationItem
                    key={conv.partner.id}
                    conv={conv}
                    onOpen={() => openConversation(conv.partner)}
                    onDelete={() => setConversationToDelete(conv)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ── New chat / user picker ── */}
        {drawerView === "new" && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <button
                type="button"
                onClick={backToList}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-semibold text-gray-800">Nouvelle conversation</span>
            </div>

            <div className="px-4 py-2 border-b">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-100 rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#007090]/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSearch(""); openConversation(u) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                >
                  <Avatar name={u.name} />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{u.name}</div>
                    <div className="text-xs text-gray-500">{roleFr(u.role)}</div>
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">Aucun utilisateur trouvé</p>
              )}
            </div>
          </>
        )}

        {/* ── Chat view ── */}
        {drawerView === "chat" && activePartner && (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#007090] text-white">
              <button
                type="button"
                onClick={backToList}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Avatar name={activePartner.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{activePartner.name}</div>
                <div className="text-xs text-white/70">{roleFr(activePartner.role)}</div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-4">
              {loadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#007090]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="h-10 w-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs text-gray-400">Aucun message. Dites bonjour !</p>
                </div>
              ) : (
                <>
                  {groupedMessages.map((group) =>
                    group.msgs.map((msg, idx) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        onRequestDelete={() => setMessageToDelete(msg)}
                        showDate={idx === 0}
                        dateLabel={group.date}
                      />
                    )),
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Votre message..."
                  rows={1}
                  className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#007090]/30 focus:border-[#007090] max-h-24 overflow-y-auto"
                  style={{ height: "auto" }}
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = "auto"
                    t.style.height = `${t.scrollHeight}px`
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex-shrink-0 h-9 w-9 rounded-full bg-[#007090] text-white flex items-center justify-center hover:bg-[#005570] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {messageToDelete && (
        <DeleteMessageModal
          isMine={messageToDelete.is_mine}
          onCancel={() => setMessageToDelete(null)}
          onConfirm={(scope) => {
            deleteMessage(messageToDelete.id, scope)
            setMessageToDelete(null)
          }}
        />
      )}

      {conversationToDelete && (
        <DeleteConversationModal
          partnerName={conversationToDelete.partner.name}
          onCancel={() => setConversationToDelete(null)}
          onConfirm={() => {
            deleteConversation(conversationToDelete.partner.id)
            setConversationToDelete(null)
          }}
        />
      )}
    </>
  )
}
