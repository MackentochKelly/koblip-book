import { expect, test } from "vitest"

import {
  applyEvent,
  CHAT_STORAGE_VERSION,
  newReply,
  fromMessages,
  markCutOff,
  withdrawLast,
  resolveConfirm,
  restoreChat,
  saveChat,
  toMessages,
  type ChatItem,
} from "./chat-state"
import type { AssistantStreamEvent } from "../types"

const owner: ChatItem = { id: "o1", role: "owner", text: "Hi" }
// The reply the events go to, added before its answer starts.
const R = "r1"
const replyTo = (id = R): ChatItem => ({ ...newReply(), id })

test("text events build one reply after the owner's message", () => {
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(items, { type: "text", delta: "Hel" }, R)
  items = applyEvent(items, { type: "text", delta: "lo" }, R)
  expect(items).toHaveLength(2)
  expect(items[1]).toMatchObject({ role: "assistant", text: "Hello" })
})

test("a step updates in place by id", () => {
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(
    items,
    {
      type: "step",
      id: "s1",
      label: "Finding bookings…",
      status: "running",
    },
    R
  )
  items = applyEvent(
    items,
    {
      type: "step",
      id: "s1",
      label: "Found bookings",
      status: "done",
    },
    R
  )
  const reply = items[1]
  expect(reply.role === "assistant" && reply.steps).toEqual([
    { id: "s1", label: "Found bookings", status: "done" },
  ])
})

test("a confirm starts pending and can be resolved", () => {
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(
    items,
    {
      type: "confirm",
      id: "c1",
      title: "Cancel booking",
      summary: "Ana, 3pm",
      destructive: true,
      action: "Cancel booking",
    },
    R
  )
  items = resolveConfirm(items, "c1", "accepted")
  const reply = items[1]
  expect(reply.role === "assistant" && reply.confirms[0].state).toBe("accepted")
})

test("done and error leave the items alone", () => {
  const items: ChatItem[] = [owner, replyTo()]
  expect(applyEvent(items, { type: "done" }, R)).toBe(items)
  expect(applyEvent(items, { type: "error", code: "unavailable" }, R)).toBe(
    items
  )
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
      times: null,
      result: null,
      sources: [],
      memory: [],
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
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(items, { type: "text", delta: "Which one?" }, R)
  items = applyEvent(
    items,
    {
      type: "choices",
      options: ["Classic Haircut", "Buzz Cut"],
    },
    R
  )
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
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(items, { type: "text", delta: "Which one?" }, R)
  items = applyEvent(items, { type: "choices", options: ["A", "B"] }, R)
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
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(
    items,
    {
      type: "result",
      ok: true,
      text: "Cancelled the booking.",
      kind: "bookings",
    },
    R
  )
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

test("sources land on the reply, not in its words", () => {
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(items, { type: "text", delta: "3 today." }, R)
  items = applyEvent(
    items,
    {
      type: "sources",
      items: [{ kind: "bookings", count: 3 }],
    },
    R
  )
  const reply = items[1]
  expect(reply.role === "assistant" && reply.sources).toEqual([
    { kind: "bookings", count: 3 },
  ])
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

test("a cut-off reply keeps what the owner got; the first mark wins", () => {
  const items = applyEvent(
    [owner, replyTo()],
    { type: "text", delta: "You have 2 today" },
    R
  )
  const heard = markCutOff(items, "You have")
  expect(heard.at(-1)).toMatchObject({ cutOff: "You have" })
  expect(markCutOff(heard).at(-1)).toMatchObject({ cutOff: "You have" })
  // Typed: what was on screen.
  expect(markCutOff(items).at(-1)).toMatchObject({ cutOff: "You have 2 today" })
  // Heard to the end (Markdown aside): not a cut-off.
  const bold = applyEvent(
    [owner, replyTo()],
    { type: "text", delta: "**Sofia** at 11." },
    R
  )
  expect(markCutOff(bold, "Sofia at 11.")).toEqual(bold)
  // No reply yet: nothing to mark.
  expect(markCutOff([owner])).toEqual([owner])
  // The server gets only what was heard, marked.
  expect(toMessages(heard, 10).at(-1)).toEqual({
    role: "assistant",
    text: "You have",
    interrupted: true,
  })
  expect(toMessages(markCutOff(items, ""), 10)).toEqual([
    { role: "owner", text: "Hi" },
  ])
})

test("withdrawLast takes the last question and its reply off", () => {
  const first: ChatItem = { id: "o0", role: "owner", text: "Earlier" }
  const replied = applyEvent(
    [first, owner, replyTo()],
    { type: "text", delta: "Hm" },
    R
  )
  expect(withdrawLast(replied)).toEqual([first])
  expect(withdrawLast([first, owner])).toEqual([first])
})

test("free times land on the reply and come back from storage", () => {
  const times = {
    service: "Cut",
    teamMember: null,
    today: "2026-10-28",
    days: [{ date: "2026-10-28", times: ["09:00"] }],
  }
  const items = applyEvent(
    [{ id: "o", role: "owner", text: "Book" }, replyTo()],
    { type: "times", ...times },
    R
  )
  const reply = items[items.length - 1]
  expect(reply.role === "assistant" && reply.times).toEqual(times)
  expect(restoreChat(saveChat(items))).toEqual(items)
})

test("an event never makes a reply: one with no reply on screen changes nothing", () => {
  const events: AssistantStreamEvent[] = [
    { type: "text", delta: "Hi" },
    { type: "choices", options: ["A", "B"] },
  ]
  for (const event of events) {
    expect(applyEvent([owner], event, R)).toEqual([owner])
  }
})

test("an answer's memory lands on it, goes back with it, and is kept", () => {
  const rows = [{ kind: "booking" as const, id: "k1", label: "Ana · Cut" }]
  let items: ChatItem[] = [owner, replyTo()]
  items = applyEvent(items, { type: "text", delta: "Ana at 10." }, R)
  items = applyEvent(items, { type: "memory", rows }, R)
  expect(toMessages(items, 20)).toEqual([
    { role: "owner", text: "Hi" },
    { role: "assistant", text: "Ana at 10.", memory: rows },
  ])
  expect(restoreChat(saveChat(items))).toEqual(items)
  // A saved chat brings its memory back too.
  expect(fromMessages(toMessages(items, 20))[1]).toMatchObject({
    memory: rows,
  })
})
