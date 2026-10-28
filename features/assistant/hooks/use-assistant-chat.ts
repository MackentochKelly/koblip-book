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

  const consume = async (stream: AsyncIterable<AssistantStreamEvent>) => {
    setBusy(true)
    setError(null)
    unsaved.current = true
    try {
      for await (const event of stream) {
        if (event.type === "error") setError(event.code)
        else setItems((current) => applyEvent(current, event))
      }
    } catch {
      setError("unavailable")
    } finally {
      setBusy(false)
    }
  }

  // Only a question can be stopped; a tapped action always finishes.
  const asking = useRef<AbortController | null>(null)
  const [stoppable, setStoppable] = useState(false)
  const ask = async (history: ChatItem[]) => {
    const controller = new AbortController()
    asking.current = controller
    setStoppable(true)
    await consume(
      transport.chat(
        {
          businessId,
          messages: toMessages(history, ASSISTANT_RULES.maxHistoryMessages),
        },
        controller.signal
      )
    )
    if (asking.current === controller) {
      asking.current = null
      setStoppable(false)
    }
  }
  const stop = () => asking.current?.abort()

  const send = (text: string) => {
    const clean = text.trim()
    if (!clean || busy || clean.length > ASSISTANT_RULES.maxMessageChars) return
    const next: ChatItem[] = [
      ...items,
      { id: crypto.randomUUID(), role: "owner", text: clean },
    ]
    setItems(next)
    void ask(next)
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
    setItems((current) => [
      ...resolveConfirm(current, id, accept ? "accepted" : "declined"),
      newReply(),
    ])
    void consume(transport.confirm({ businessId, id, accept }))
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
