import { expect, test } from "vitest"
import { eventColorOf } from "./google-calendar-colors"

test("a service's own colour, else its category's, else the calendar's", () => {
  expect(eventColorOf("11", "2")).toBe("11")
  expect(eventColorOf(null, "2")).toBe("2")
  expect(eventColorOf("not a colour", "2")).toBe("2")
  expect(eventColorOf(null, null)).toBeNull()
  expect(eventColorOf(undefined, "nope")).toBeNull()
})
