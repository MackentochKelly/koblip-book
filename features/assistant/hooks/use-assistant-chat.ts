"use client"

import { useEffect, useRef, useState } from "react"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type {
  AssistantConfirmRequest,
  AssistantRequest,
  AssistantStreamEvent,
} from "../types"
import { getChat, putChat } from "../utils/chats-client"
import {
  applyEvent,
  fromMessages,
  newReply,
  resolveConfirm,
  restoreChat,
  saveChat,
  toMessages,
  type ChatItem,
} from "../utils/chat-state"

// How the screen talks to the server: two calls, each a stream of events.
export interface AssistantTransport {
  chat(
    request: AssistantRequest,
    signal?: AbortSignal
  ): AsyncIterable<AssistantStreamEvent>
  confirm(request: AssistantConfirmRequest): AsyncIterable<AssistantStreamEvent>
}

type ErrorCode = Extract<AssistantStreamEvent, { type: "error" }>["code"]

// The chat's state: what was said, whether the assistant is working, and
// what went wrong. The words live only while the page stays open.
export function useAssistantChat(
  businessId: string,
  transport: AssistantTransport
) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [restored, setRestored] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  // This chat's id on the server; a new chat gets a new one.
  const [chatId, setChatId] = useState(() => crypto.randomUUID())
  // True after a reply until it has been saved.
  const unsaved = useRef(false)

  // The conversation survives a visit to another tab, but not closing the
  // browser tab. Read after the first paint so the server and the browser
  // draw the same thing first.
  const storageKey = `assistant-chat:${businessId}`
  const idKey = `assistant-chat-id:${businessId}`
  useEffect(() => {
    queueMicrotask(() => {
      try {
        // A chat from another version or of another shape starts fresh.
        setItems(restoreChat(sessionStorage.getItem(storageKey)))
        const savedId = sessionStorage.getItem(idKey)
        if (savedId) setChatId(savedId)
      } catch {
        // Nothing saved, or storage is off.
      }
      setRestored(true)
    })
  }, [storageKey, idKey])
  useEffect(() => {
    if (!restored) return
    try {
      if (items.length > 0) {
        sessionStorage.setItem(storageKey, saveChat(items))
        sessionStorage.setItem(idKey, chatId)
      } else {
        sessionStorage.removeItem(storageKey)
        sessionStorage.removeItem(idKey)
      }
    } catch {
      // Storage is off: the chat just will not be remembered.
    }
  }, [items, restored, storageKey, idKey, chatId])

  // After each reply, the chat is saved for the Recent list. A save that
  // fails is tried again after the next reply.
  useEffect(() => {
    if (busy || !unsaved.current) return
    const messages = toMessages(items, ASSISTANT_RULES.maxSavedMessages)
    if (!messages.some((message) => message.role === "owner")) return
    unsaved.current = false
    void putChat(businessId, chatId, messages).then((saved) => {
      if (!saved) unsaved.current = true
    })
  }, [busy, items, businessId, chatId])

  // Shows each event as it comes, and gives back the items as they end, so
  // a caller (talking mode) can read the finished reply without waiting for
  // the screen to update.
  const consume = async (
    stream: AsyncIterable<AssistantStreamEvent>,
    start: ChatItem[]
  ): Promise<ChatItem[]> => {
    setBusy(true)
    setError(null)
    unsaved.current = true
    let latest = start
    try {
      for await (const event of stream) {
        if (event.type === "error") setError(event.code)
        else {
          latest = applyEvent(latest, event)
          setItems((current) => applyEvent(current, event))
        }
      }
    } catch {
      setError("unavailable")
    } finally {
      setBusy(false)
    }
    return latest
  }

  // Only a question can be stopped; a tapped action always finishes.
  const asking = useRef<AbortController | null>(null)
  const [stoppable, setStoppable] = useState(false)
  // Resolves with the reply, or null when nothing came back.
  const ask = async (history: ChatItem[], voice = false) => {
    const controller = new AbortController()
    asking.current = controller
    setStoppable(true)
    const latest = await consume(
      transport.chat(
        {
          businessId,
          messages: toMessages(history, ASSISTANT_RULES.maxHistoryMessages),
          ...(voice ? { voice: true } : {}),
        },
        controller.signal
      ),
      history
    )
    if (asking.current === controller) {
      asking.current = null
      setStoppable(false)
    }
    const reply = latest.at(-1)
    return reply?.role === "assistant" ? reply : null
  }
  const stop = () => asking.current?.abort()

  // `voice`: said out loud in talking mode, so the answer is short and
  // spoken. Resolves with the reply (null when not sent or none came).
  const send = async (text: string, options?: { voice?: boolean }) => {
    const clean = text.trim()
    if (!clean || busy || clean.length > ASSISTANT_RULES.maxMessageChars) {
      return null
    }
    const next: ChatItem[] = [
      ...items,
      { id: crypto.randomUUID(), role: "owner", text: clean },
    ]
    setItems(next)
    return ask(next, options?.voice === true)
  }

  // Try the last message again, without the half-written reply.
  const retry = () => {
    if (busy) return
    const last = items.at(-1)
    const history = last?.role === "assistant" ? items.slice(0, -1) : items
    setItems(history)
    void ask(history)
  }

  const answer = (id: string, accept: boolean) => {
    if (busy) return
    const next = [
      ...resolveConfirm(items, id, accept ? "accepted" : "declined"),
      newReply(),
    ]
    setItems(next)
    void consume(transport.confirm({ businessId, id, accept }), next)
  }

  const reset = () => {
    if (busy) return
    setItems([])
    setError(null)
    setChatId(crypto.randomUUID())
  }

  // Opens a saved chat in place of this one. False when it could not load.
  const open = async (id: string) => {
    if (busy) return false
    const chat = await getChat(businessId, id)
    if (!chat) return false
    setItems(fromMessages(chat.messages))
    setError(null)
    setChatId(chat.id)
    return true
  }

  return {
    items,
    busy,
    error,
    chatId,
    send,
    retry,
    answer,
    reset,
    open,
    stop,
    stoppable,
  }
}
