import { expect, test } from "vitest"

import { activityFilterFrom, activityQuery } from "./activity-filter"

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
