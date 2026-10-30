import { expect, test } from "vitest"

import { inQuietHours, localDateTime, planReminders } from "./reminder-schedule"

// Santo Domingo is UTC-4 all year.
const zone = "America/Santo_Domingo"
const at = (local: string) => new Date(`${local}:00-04:00`)
const plan = (booked: string, start: string, reminders = [1440, 120, 30]) =>
  planReminders({
    bookedAt: at(booked),
    startAt: at(start),
    reminders,
    quietStart: "21:00",
    quietEnd: "08:00",
    timeZone: zone,
  }).map(({ minutes, dueAt }) => [minutes, localDateTime(dueAt, zone)])

test("the agreed rules for the default reminders", () => {
  // More than a day ahead: 24 h and 30 min.
  expect(plan("2026-11-02T10:00", "2026-11-04T15:00")).toEqual([
    [1440, { date: "2026-11-03", time: "15:00" }],
    [30, { date: "2026-11-04", time: "14:30" }],
  ])
  // Hours ahead: 2 h and 30 min.
  expect(plan("2026-11-02T10:00", "2026-11-02T18:00")).toEqual([
    [120, { date: "2026-11-02", time: "16:00" }],
    [30, { date: "2026-11-02", time: "17:30" }],
  ])
  // Two hours ahead: 30 min only.
  expect(plan("2026-11-02T10:00", "2026-11-02T12:00")).toEqual([
    [30, { date: "2026-11-02", time: "11:30" }],
  ])
  // Under an hour: none.
  expect(plan("2026-11-02T10:00", "2026-11-02T10:50")).toEqual([])
})

test("quiet hours: a long reminder moves to the evening before, a short one is skipped", () => {
  // 30 min before 08:15 is 07:45, in quiet hours.
  expect(plan("2026-11-02T10:00", "2026-11-04T08:15")).toEqual([
    [1440, { date: "2026-11-03", time: "08:15" }],
  ])
  // 2 h before 08:30 is 06:30: moved to 20:00 the evening before.
  expect(plan("2026-11-03T19:00", "2026-11-04T08:30")).toEqual([
    [120, { date: "2026-11-03", time: "20:00" }],
    [30, { date: "2026-11-04", time: "08:00" }],
  ])
  // Booked at 20:00 already: the moved time has passed, so it is dropped.
  expect(plan("2026-11-03T20:00", "2026-11-04T08:30")).toEqual([
    [30, { date: "2026-11-04", time: "08:00" }],
  ])
  // A 24 h reminder late in the evening moves to 20:00 the same evening.
  expect(plan("2026-11-01T10:00", "2026-11-03T22:00")).toEqual([
    [1440, { date: "2026-11-02", time: "20:00" }],
  ])
})

test("owner-chosen reminders and quiet hours that do not wrap midnight", () => {
  expect(plan("2026-11-02T10:00", "2026-11-04T15:00", [2880, 60])).toEqual([
    [2880, { date: "2026-11-02", time: "15:00" }],
    [60, { date: "2026-11-04", time: "14:00" }],
  ])
  expect(plan("2026-11-02T10:00", "2026-11-04T15:00", [])).toEqual([])
  expect(inQuietHours(at("2026-11-02T13:30"), "13:00", "14:00", zone)).toBe(true)
  expect(inQuietHours(at("2026-11-02T14:00"), "13:00", "14:00", zone)).toBe(false)
  expect(inQuietHours(at("2026-11-02T03:00"), "08:00", "08:00", zone)).toBe(false)
})

test("daylight saving zones keep local times", () => {
  // New York leaves daylight saving on 2026-11-01.
  const [reminder] = planReminders({
    bookedAt: new Date("2026-10-30T12:00:00-04:00"),
    startAt: new Date("2026-11-02T07:30:00-05:00"),
    reminders: [1440],
    quietStart: "21:00",
    quietEnd: "08:00",
    timeZone: "America/New_York",
  })
  // 24 h before is 07:30 on Nov 1, in quiet hours: moved to 20:00 on Oct 31.
  expect(localDateTime(reminder.dueAt, "America/New_York")).toEqual({ date: "2026-10-31", time: "20:00" })
})
