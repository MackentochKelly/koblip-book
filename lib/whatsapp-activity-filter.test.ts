import { expect, test } from "vitest"

import {
  activityFilterFrom,
  activityQuery,
  activitySources,
} from "./whatsapp-activity-filter"

test("reads known filters from the address", () => {
  expect(activityFilterFrom({ message: "reminder", state: "failed", q: " ana " })).toEqual({
    message: "reminder",
    state: "failed",
    search: "ana",
  })
})

test("ignores unknown, repeated and empty values", () => {
  expect(activityFilterFrom({ message: "nope", state: ["failed", "sent"], q: "  " })).toEqual({
    message: undefined,
    state: undefined,
    search: undefined,
  })
})

test("writes only the filters that are set", () => {
  expect(activityQuery({})).toBe("")
  expect(activityQuery({ state: "failed", search: "ana lópez" })).toBe(
    "?state=failed&q=ana+l%C3%B3pez"
  )
})

test("an address read back gives the same filter", () => {
  const filter = { message: "confirmed", state: "sent", search: "809" } as const
  const query = Object.fromEntries(new URLSearchParams(activityQuery(filter)))
  expect(activityFilterFrom(query)).toEqual(filter)
})

test("Automations is a message filter of its own, kept in the address", () => {
  const filter = activityFilterFrom({ message: "automations", state: "failed" })
  expect(filter).toEqual({
    message: undefined,
    automations: true,
    state: "failed",
  })
  expect(activityQuery(filter)).toBe("?message=automations&state=failed")
})

test("each filter loads messages, runs or both", () => {
  expect(activitySources({})).toEqual({ messages: true, runs: {} })
  expect(
    activitySources({ automations: true, state: "failed", search: "ana" })
  ).toEqual({
    messages: false,
    runs: { state: "failed", search: "ana" },
  })
  // One booking message, or a state runs never have: no runs.
  expect(activitySources({ message: "reminder" }).runs).toBeNull()
  expect(activitySources({ state: "read" }).runs).toBeNull()
})
