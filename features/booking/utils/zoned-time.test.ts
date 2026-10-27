import { expect, test } from "vitest"
import {
  addDays,
  weekdayOf,
  zonedInstant,
  zonedToday,
} from "./zoned-time"

const NY = "America/New_York"

test("spring forward: times after 02:00 use daylight offset", () => {
  // 2026-03-08: clocks jump 02:00 EST -> 03:00 EDT.
  expect(new Date(zonedInstant("2026-03-08", 60, NY)).toISOString()).toBe(
    "2026-03-08T06:00:00.000Z"
  )
  expect(new Date(zonedInstant("2026-03-08", 540, NY)).toISOString()).toBe(
    "2026-03-08T13:00:00.000Z"
  )
})

test("fall back: evening times use standard offset", () => {
  // 2026-11-01: clocks fall back 02:00 EDT -> 01:00 EST.
  expect(new Date(zonedInstant("2026-11-01", 540, NY)).toISOString()).toBe(
    "2026-11-01T14:00:00.000Z"
  )
  expect(new Date(zonedInstant("2026-11-01", 1380, NY)).toISOString()).toBe(
    "2026-11-02T04:00:00.000Z"
  )
})

test("today follows the zone across midnight", () => {
  // 03:00 UTC is still Saturday in New York.
  expect(zonedToday(Date.UTC(2026, 2, 8, 3, 0), NY)).toBe("2026-03-07")
  // 05:00 UTC is Sunday in New York.
  expect(zonedToday(Date.UTC(2026, 2, 8, 5, 0), NY)).toBe("2026-03-08")
})

test("addDays and weekdayOf are calendar based", () => {
  expect(addDays("2026-03-07", 1)).toBe("2026-03-08")
  expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
  expect(addDays("2026-03-08", -7)).toBe("2026-03-01")
  expect(weekdayOf("2026-03-08")).toBe(0)
  expect(weekdayOf("2026-03-09")).toBe(1)
  expect(weekdayOf("2026-03-07")).toBe(6)
})
