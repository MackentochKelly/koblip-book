import { act, renderHook, waitFor } from "@testing-library/react"
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

// Every answer is checked; the check ends "done".
const transport: AssistantTransport = {
  chat: () =>
    events(
      { type: "text", delta: "2 bookings." },
      {
        type: "check",
        id: "c1",
        label: "Checking…",
        failedLabel: "Not checked",
      },
      { type: "done" }
    ),
  confirm: () =>
    events(
      { type: "result", ok: true, text: "Booked.", kind: "bookings" },
      {
        type: "check",
        id: "c2",
        label: "Checking…",
        failedLabel: "Not checked",
      },
      { type: "done" }
    ),
  check: ({ id }) =>
    events({ type: "step", id, label: "Checked", status: "done" }),
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

test("a question's check ends on the reply on screen", async () => {
  const { result } = await renderChat()
  await act(async () => {
    await result.current.send("How many today?")
  })
  await waitFor(() =>
    expect(lastReply(result.current.items)?.steps).toEqual([
      { id: "c1", label: "Checked", status: "done" },
    ])
  )
  // One question, one reply.
  expect(result.current.items.map((item) => item.role)).toEqual([
    "owner",
    "assistant",
  ])
  expect(lastReply(result.current.items)?.text).toBe("2 bookings.")
})

test("a tapped action's check ends on the reply on screen", async () => {
  const { result } = await renderChat()
  await act(async () => {
    result.current.answer("p1", true)
  })
  await waitFor(() =>
    expect(lastReply(result.current.items)?.steps).toEqual([
      { id: "c2", label: "Checked", status: "done" },
    ])
  )
  expect(result.current.items).toHaveLength(1)
  expect(lastReply(result.current.items)?.result?.text).toBe("Booked.")
})

test("a check that can't answer ends in its failed words, marked unchecked", async () => {
  const { result } = await renderChat({
    ...transport,
    check: () => {
      throw new Error("offline")
    },
  })
  await act(async () => {
    await result.current.send("How many today?")
  })
  await waitFor(() =>
    expect(lastReply(result.current.items)).toMatchObject({
      steps: [{ id: "c1", label: "Not checked", status: "failed" }],
      unverified: true,
    })
  )
})
