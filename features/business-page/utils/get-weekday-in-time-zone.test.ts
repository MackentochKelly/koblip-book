import { expect, test } from "vitest"
import { getWeekdayInTimeZone } from "./get-weekday-in-time-zone"

test("returns the weekday in the given timezone", () => {
  // Monday 2026-10-26 12:00 UTC is still Monday in Santo Domingo (UTC-4).
  expect(
    getWeekdayInTimeZone(
      "America/Santo_Domingo",
      new Date("2026-10-26T12:00:00Z")
    )
  ).toBe(1)
  // Monday 2026-10-26 02:00 UTC is still Sunday in Santo Domingo.
  expect(
    getWeekdayInTimeZone(
      "America/Santo_Domingo",
      new Date("2026-10-26T02:00:00Z")
    )
  ).toBe(0)
})
