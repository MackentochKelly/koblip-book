import { describe, expect, it } from "vitest"
import {
  formatDayRange,
  addDaysTo,
  dayFromDate,
  dayOfMonth,
  dateFromDay,
  formatClock,
  formatDay,
  formatWeekdayShort,
  todayIn,
} from "./format-booking-time"

describe("format-booking-time", () => {
  it("shows times on a 12-hour clock", () => {
    expect(formatClock("09:00")).toBe("9:00 AM")
    expect(formatClock("14:30")).toBe("2:30 PM")
  })

  it("shows days without moving them to another time zone", () => {
    expect(formatDay("2026-10-27")).toBe("Tuesday, October 27")
    expect(formatWeekdayShort("2026-10-27")).toBe("Tue")
    expect(dayOfMonth("2026-10-27")).toBe(27)
  })

  it("shows a range of days", () => {
    // Intl puts thin spaces around the dash.
    expect(formatDayRange("2026-10-27", "2026-11-09")).toMatch(
      /^Oct 27\s–\sNov 9$/
    )
  })

  it("adds days across a month", () => {
    expect(addDaysTo("2026-10-31", 1)).toBe("2026-11-01")
  })

  it("finds today in the business's time zone", () => {
    const now = new Date("2026-10-28T02:00:00Z")
    expect(todayIn("America/New_York", now)).toBe("2026-10-27")
    expect(todayIn("UTC", now)).toBe("2026-10-28")
  })

  it("round-trips a calendar day", () => {
    expect(dayFromDate(dateFromDay("2026-03-08"))).toBe("2026-03-08")
  })
})
