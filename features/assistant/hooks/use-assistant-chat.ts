"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type {
  AnswerListener,
  AssistantCheckRequest,
  AssistantConfirmRequest,
  AssistantRequest,
  AssistantStreamEvent,
} from "../types"
import {
  clearHandOff,
  type HandOff,
  readHandOff,
} from "../utils/ask-handoff"
import { getChat, putChat } from "../utils/chats-client"
import {
  applyEvent,
  fromMessages,
  markCutOff,
  newReply,
  withdrawLast,
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
  check(request: AssistantCheckRequest): AsyncIterable<AssistantStreamEvent>
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
  // Something started on another page (the Ask card) begins a new chat
  // instead: its question is sent once the chat is ready, or talking live
  // starts (see liveRequested).
  const [handedOff, setHandedOff] = useState<HandOff | null>(null)
  useEffect(() => {
    queueMicrotask(() => {
      const started = readHandOff(businessId)
      if (started) {
        setHandedOff(started)
      } else {
        try {
          // A chat from another version or of another shape starts fresh.
          setItems(restoreChat(sessionStorage.getItem(storageKey)))
          const savedId = sessionStorage.getItem(idKey)
          if (savedId) setChatId(savedId)
        } catch {
          // Nothing saved, or storage is off.
        }
      }
      setRestored(true)
    })
  }, [businessId, storageKey, idKey])
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

  // An answer's check, run after its reply ended so nothing waits for it:
  // its outcome goes to that reply, even when the owner already asked
  // again. A check that fails to answer marks the reply unchecked, and
  // `listen` hears it (talking mode says so).
  const runCheck = async (
    { id, label }: { id: string; label: string },
    replyId: string,
    listen?: AnswerListener
  ) => {
    const apply = (event: AssistantStreamEvent) =>
      setItems((current) => applyEvent(current, event, replyId))
    let ended = false
    try {
      for await (const event of transport.check({ businessId, id })) {
        if (event.type === "error") break
        if (event.type === "step") ended = true
        if (event.type === "notice") listen?.onUnchecked?.()
        apply(event)
      }
    } catch {
      // Same as no answer: marked unchecked below.
    }
    if (!ended) {
      apply({ type: "step", id, label, status: "failed" })
      apply({ type: "notice", kind: "unverified" })
      listen?.onUnchecked?.()
    }
  }

  // Shows each event as it comes, and gives back the items as they end, so
  // a caller (talking mode) can read the finished reply without waiting for
  // the screen to update.
  const consume = async (
    stream: AsyncIterable<AssistantStreamEvent>,
    start: ChatItem[],
    listen?: AnswerListener
  ): Promise<ChatItem[]> => {
    setBusy(true)
    setError(null)
    unsaved.current = true
    let latest = start
    let check: { id: string; label: string } | null = null
    try {
      for await (const event of stream) {
        if (event.type === "check") check = event
        if (event.type === "error") setError(event.code)
        else {
          if (event.type === "text") listen?.onText(event.delta)
          if (event.type === "step" && event.status === "running") {
            listen?.onLookup()
          }
          latest = applyEvent(latest, event)
          setItems((current) => applyEvent(current, event))
        }
      }
    } catch {
      setError("unavailable")
    } finally {
      setBusy(false)
    }
    const reply = latest.at(-1)
    if (check !== null && reply?.role === "assistant") {
      void runCheck(check, reply.id, listen)
    }
    return latest
  }

  // Only a question can be stopped; a tapped action always finishes.
  const asking = useRef<AbortController | null>(null)
  const [stoppable, setStoppable] = useState(false)
  // Resolves with the reply, or null when nothing came back.
  const ask = async (
    history: ChatItem[],
    voice = false,
    listen?: AnswerListener
  ) => {
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
      history,
      listen
    )
    if (asking.current === controller) {
      asking.current = null
      setStoppable(false)
    }
    const reply = latest.at(-1)
    return reply?.role === "assistant" ? reply : null
  }
  // The owner cut the answer off: in talking mode with what they heard of
  // it, typed with what was on screen.
  const cutOff = (heard?: string) =>
    setItems((current) => markCutOff(current, heard))
  const stop = () => {
    if (!asking.current) return
    asking.current.abort()
    cutOff()
  }
  const withdraw = () => setItems(withdrawLast)

  // `voice`: said out loud in talking mode, so the answer is short and
  // spoken; `listen` hears its words as they are written. Resolves with the
  // reply (null when not sent or none came).
  const send = async (
    text: string,
    options?: { voice?: boolean; listen?: AnswerListener }
  ) => {
    const clean = text.trim()
    if (!clean || busy || clean.length > ASSISTANT_RULES.maxMessageChars) {
      return null
    }
    const next: ChatItem[] = [
      ...items,
      { id: crypto.randomUUID(), role: "owner", text: clean },
    ]
    setItems(next)
    return ask(next, options?.voice === true, options?.listen)
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

  // Taken once the chat has started from it.
  useEffect(() => {
    if (restored && handedOff) clearHandOff(businessId)
  }, [restored, handedOff, businessId])
  // A handed-off question is sent once, when the chat is ready.
  const sendHandedOff = useEffectEvent((question: string) => {
    setHandedOff(null)
    void send(question)
  })
  useEffect(() => {
    if (!restored || handedOff?.kind !== "ask") return
    const question = handedOff.text
    queueMicrotask(() => sendHandedOff(question))
  }, [restored, handedOff])

  return {
    items,
    // The owner tapped Talk live on another page: start it here.
    liveRequested: restored && handedOff?.kind === "live",
    busy,
    error,
    chatId,
    send,
    retry,
    answer,
    reset,
    open,
    stop,
    cutOff,
    withdraw,
    stoppable,
  }
}
