import { act, renderHook } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, expect, test, vi } from "vitest"

import type { AssistantStreamEvent } from "../types"
import { type AssistantTransport, useAssistantChat } from "./use-assistant-chat"

// Saving for the Recent list talks to the server; not part of this test.
vi.mock("../utils/chats-client", () => ({
  getChat: vi.fn(async () => null),
  putChat: vi.fn(async () => true),
}))

afterEach(() => sessionStorage.clear())

async function* events(...list: AssistantStreamEvent[]) {
  for (const event of list) yield event
}

const transport: AssistantTransport = {
  chat: () => events({ type: "text", delta: "2 bookings." }, { type: "done" }),
  confirm: () =>
    events(
      { type: "result", ok: true, text: "Booked.", kind: "bookings" },
      { type: "done" }
    ),
}

// Strict mode runs each state update twice, as React may in production.
// Resolves once the saved chat is read, as on screen before the owner acts.
async function renderChat(using = transport) {
  const chat = renderHook(() => useAssistantChat("b1", using), {
    wrapper: StrictMode,
  })
  await act(async () => {})
  return chat
}

const lastReply = (items: ReturnType<typeof useAssistantChat>["items"]) => {
  const reply = items.at(-1)
  return reply?.role === "assistant" ? reply : null
}

test("a question gets one reply on screen", async () => {
  const { result } = await renderChat()
  await act(async () => {
    await result.current.send("How many today?")
  })
  expect(result.current.items.map((item) => item.role)).toEqual([
    "owner",
    "assistant",
  ])
  expect(lastReply(result.current.items)?.text).toBe("2 bookings.")
})

test("a tapped action's result lands on the reply on screen", async () => {
  const { result } = await renderChat()
  await act(async () => {
    result.current.answer("p1", true)
  })
  expect(result.current.items).toHaveLength(1)
  expect(lastReply(result.current.items)?.result?.text).toBe("Booked.")
})

test("after a tap, talking asks with nothing new said and the tap's answer", async () => {
  const chat = vi.fn(() =>
    events({ type: "text", delta: "Ana's booked." }, { type: "done" })
  )
  const { result } = await renderChat({ ...transport, chat })
  await act(async () => {
    await result.current.send("Book Ana")
  })
  await act(async () => {
    await result.current.answer("c1", true)
  })
  chat.mockClear()
  const listen = { onText: vi.fn(), onLookup: vi.fn() }
  await act(async () => {
    await result.current.resume("yes", listen)
  })
  expect(chat).toHaveBeenCalledTimes(1)
  const [request] = chat.mock.calls[0] as unknown as [
    { voice?: boolean; afterTap?: string; messages: { text: string }[] },
  ]
  expect(request.voice).toBe(true)
  expect(request.afterTap).toBe("yes")
  expect(request.messages.at(-1)?.text).toBe("Booked.")
  expect(listen.onText).toHaveBeenCalledWith("Ana's booked.")
  expect(lastReply(result.current.items)?.text).toBe("Ana's booked.")
})
