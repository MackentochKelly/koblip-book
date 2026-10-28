import { expect, test } from "vitest"

import {
  applyEvent,
  resolveConfirm,
  toMessages,
  type ChatItem,
} from "./chat-state"

const owner: ChatItem = { id: "o1", role: "owner", text: "Hi" }

test("text events build one reply after the owner's message", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, { type: "text", delta: "Hel" })
  items = applyEvent(items, { type: "text", delta: "lo" })
  expect(items).toHaveLength(2)
  expect(items[1]).toMatchObject({ role: "assistant", text: "Hello" })
})

test("a step updates in place by id", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, {
    type: "step",
    id: "s1",
    label: "Finding bookings…",
    status: "running",
  })
  items = applyEvent(items, {
    type: "step",
    id: "s1",
    label: "Found bookings",
    status: "done",
  })
  const reply = items[1]
  expect(reply.role === "assistant" && reply.steps).toEqual([
    { id: "s1", label: "Found bookings", status: "done" },
  ])
})

test("a confirm starts pending and can be resolved", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, {
    type: "confirm",
    id: "c1",
    title: "Cancel booking",
    summary: "Ana, 3pm",
    destructive: true,
  })
  items = resolveConfirm(items, "c1", "accepted")
  const reply = items[1]
  expect(reply.role === "assistant" && reply.confirms[0].state).toBe("accepted")
})

test("done and error leave the items alone", () => {
  const items: ChatItem[] = [owner]
  expect(applyEvent(items, { type: "done" })).toBe(items)
  expect(applyEvent(items, { type: "error", code: "unavailable" })).toBe(items)
})

test("toMessages skips empty replies and keeps the newest", () => {
  const items: ChatItem[] = [
    owner,
    {
      id: "a1",
      role: "assistant",
      text: "",
      steps: [],
      confirms: [],
    },
    { id: "o2", role: "owner", text: "Again" },
  ]
  expect(toMessages(items, 20)).toEqual([
    { role: "owner", text: "Hi" },
    { role: "owner", text: "Again" },
  ])
  expect(toMessages(items, 1)).toEqual([{ role: "owner", text: "Again" }])
})
