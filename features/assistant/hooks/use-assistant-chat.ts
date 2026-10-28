"use client"

import { useEffect, useState } from "react"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type {
  AssistantConfirmRequest,
  AssistantRequest,
  AssistantStreamEvent,
} from "../types"
import {
  applyEvent,
  newReply,
  resolveConfirm,
  restoreChat,
  saveChat,
  toMessages,
  type ChatItem,
} from "../utils/chat-state"

// How the screen talks to the server: two calls, each a stream of events.
export interface AssistantTransport {
  chat(request: AssistantRequest): AsyncIterable<AssistantStreamEvent>
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

  // The conversation survives a visit to another tab, but not closing the
  // browser tab. Read after the first paint so the server and the browser
  // draw the same thing first.
  const storageKey = `assistant-chat:${businessId}`
  useEffect(() => {
    queueMicrotask(() => {
      try {
        // A chat from another version or of another shape starts fresh.
        setItems(restoreChat(sessionStorage.getItem(storageKey)))
      } catch {
        // Nothing saved, or storage is off.
      }
      setRestored(true)
    })
  }, [storageKey])
  useEffect(() => {
    if (!restored) return
    try {
      if (items.length > 0) {
        sessionStorage.setItem(storageKey, saveChat(items))
      } else {
        sessionStorage.removeItem(storageKey)
      }
    } catch {
      // Storage is off: the chat just will not be remembered.
    }
  }, [items, restored, storageKey])

  const consume = async (stream: AsyncIterable<AssistantStreamEvent>) => {
    setBusy(true)
    setError(null)
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

  const ask = (history: ChatItem[]) =>
    consume(
      transport.chat({
        businessId,
        messages: toMessages(history, ASSISTANT_RULES.maxHistoryMessages),
      })
    )

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
  }

  return { items, busy, error, send, retry, answer, reset }
}
