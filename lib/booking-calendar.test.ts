import { expect, test } from "vitest"

import { calendarFile, googleCalendarHref } from "./booking-calendar"

const event = {
  id: "b1",
  title: "Haircut, Palacete",
  startAt: "2026-11-07T15:00:00.000Z",
  endAt: "2026-11-07T15:30:00.000Z",
  location: "Av. Churchill 1; Santo Domingo",
  details: "Short on the sides\nThanks",
}

test("a calendar file any calendar app reads (RFC 5545)", () => {
  const file = calendarFile(event, new Date("2026-11-06T12:00:00.000Z"))
  expect(file).toContain("UID:b1@koblip.com\r\n")
  expect(file).toContain("DTSTART:20261107T150000Z\r\n")
  expect(file).toContain("DTEND:20261107T153000Z\r\n")
  expect(file).toContain("SUMMARY:Haircut\\, Palacete\r\n")
  expect(file).toContain("LOCATION:Av. Churchill 1\; Santo Domingo\r\n")
  expect(file).toContain("DESCRIPTION:Short on the sides\\nThanks\r\n")
  expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true)
})

test("long lines fold at 75 octets", () => {
  const file = calendarFile({ ...event, details: "ñ".repeat(100) })
  for (const line of file.split("\r\n")) {
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  }
})

test("Google Calendar's link carries the same event", () => {
  const url = new URL(googleCalendarHref(event))
  expect(url.searchParams.get("action")).toBe("TEMPLATE")
  expect(url.searchParams.get("dates")).toBe(
    "20261107T150000Z/20261107T153000Z"
  )
  expect(url.searchParams.get("location")).toBe(event.location)
})
