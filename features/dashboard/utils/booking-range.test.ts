import { expect, test } from "vitest"
import {
  monthFrom,
  monthRange,
  presetOf,
  presetRange,
  rangeFrom,
  shiftMonth,
} from "./booking-range"

const today = "2026-10-31"

test("the page opens on the last 30 days and next 3 months", () => {
  expect(rangeFrom(undefined, undefined, today)).toEqual({
    from: "2026-10-01",
    to: "2027-01-29",
  })
  expect(presetOf(rangeFrom(null, null, today), today)).toBe("around")
})

test("a good range in the address is kept, a bad one is not", () => {
  expect(rangeFrom("2026-01-01", "2026-01-31", today)).toEqual({
    from: "2026-01-01",
    to: "2026-01-31",
  })
  const around = presetRange("around", today)
  expect(rangeFrom("2026-02-31", "2026-03-01", today)).toEqual(around)
  expect(rangeFrom("2026-03-01", "2026-02-01", today)).toEqual(around)
  expect(rangeFrom("2025-01-01", "2026-06-01", today)).toEqual(around)
  expect(presetOf({ from: "2026-01-01", to: "2026-01-31" }, today)).toBeNull()
})

test("months: from the address, their days, and the next or last", () => {
  expect(monthFrom("2026-12", today)).toBe("2026-12")
  expect(monthFrom("2026-13", today)).toBe("2026-10")
  expect(monthRange("2026-02")).toEqual({
    from: "2026-01-25",
    to: "2026-03-07",
  })
  expect(shiftMonth("2026-12", 1)).toBe("2027-01")
  expect(shiftMonth("2026-01", -1)).toBe("2025-12")
})
