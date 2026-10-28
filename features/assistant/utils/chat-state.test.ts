import { expect, test } from "vitest"

import {
  applyEvent,
  CHAT_STORAGE_VERSION,
  fromMessages,
  resolveConfirm,
  restoreChat,
  saveChat,
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
    action: "Cancel booking",
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
      choices: [],
      result: null,
      sources: [],
      unverified: false,
    },
    { id: "o2", role: "owner", text: "Again" },
  ]
  expect(toMessages(items, 20)).toEqual([
    { role: "owner", text: "Hi" },
    { role: "owner", text: "Again" },
  ])
  expect(toMessages(items, 1)).toEqual([{ role: "owner", text: "Again" }])
})

test("choices land on the reply and are not sent back as words", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, { type: "text", delta: "Which one?" })
  items = applyEvent(items, {
    type: "choices",
    options: ["Classic Haircut", "Buzz Cut"],
  })
  const reply = items[1]
  expect(reply.role === "assistant" && reply.choices).toEqual([
    "Classic Haircut",
    "Buzz Cut",
  ])
  expect(toMessages(items, 10)).toEqual([
    { role: "owner", text: "Hi" },
    { role: "assistant", text: "Which one?" },
  ])
})

test("a saved chat comes back as it was", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, { type: "text", delta: "Which one?" })
  items = applyEvent(items, { type: "choices", options: ["A", "B"] })
  expect(restoreChat(saveChat(items))).toEqual(items)
})

test("an older or broken saved chat starts fresh instead of breaking", () => {
  const reply = {
    id: "a1",
    role: "assistant",
    text: "Hi",
    steps: [],
    confirms: [],
  }
  // Saved before versions existed: a bare list.
  expect(restoreChat(JSON.stringify([owner, reply]))).toEqual([])
  // Another version.
  expect(
    restoreChat(
      JSON.stringify({ version: CHAT_STORAGE_VERSION - 1, items: [owner] })
    )
  ).toEqual([])
  // This version, but a reply missing a field.
  expect(
    restoreChat(
      JSON.stringify({ version: CHAT_STORAGE_VERSION, items: [owner, reply] })
    )
  ).toEqual([])
  expect(restoreChat("not json")).toEqual([])
  expect(restoreChat(null)).toEqual([])
})

test("a tapped action's result lands on the reply and goes back as words", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, {
    type: "result",
    ok: true,
    text: "Cancelled the booking.",
    kind: "bookings",
  })
  const reply = items[1]
  expect(reply.role === "assistant" && reply.result).toEqual({
    ok: true,
    text: "Cancelled the booking.",
    kind: "bookings",
  })
  expect(toMessages(items, 10)).toEqual([
    { role: "owner", text: "Hi" },
    { role: "assistant", text: "Cancelled the booking." },
  ])
  expect(restoreChat(saveChat(items))).toEqual(items)
})

test("sources and the unverified notice land on the reply, not in its words", () => {
  let items: ChatItem[] = [owner]
  items = applyEvent(items, { type: "text", delta: "3 today." })
  items = applyEvent(items, {
    type: "sources",
    items: [{ kind: "bookings", count: 3 }],
  })
  items = applyEvent(items, { type: "notice", kind: "unverified" })
  const reply = items[1]
  expect(reply.role === "assistant" && reply.sources).toEqual([
    { kind: "bookings", count: 3 },
  ])
  expect(reply.role === "assistant" && reply.unverified).toBe(true)
  expect(toMessages(items, 10).at(-1)).toEqual({
    role: "assistant",
    text: "3 today.",
  })
  expect(restoreChat(saveChat(items))).toEqual(items)
})

test("a saved chat's words come back as items with their words", () => {
  const messages = [
    { role: "owner" as const, text: "Hi" },
    { role: "assistant" as const, text: "Hello" },
  ]
  const items = fromMessages(messages)
  expect(items.map((item) => item.role)).toEqual(["owner", "assistant"])
  expect(toMessages(items, 10)).toEqual(messages)
})
