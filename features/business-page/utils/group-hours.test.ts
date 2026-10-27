import { expect, test } from "vitest"
import type { BusinessHour } from "../types"
import { groupHours } from "./group-hours"

function row(
  overrides: Partial<BusinessHour> & { weekday: number }
): BusinessHour {
  return {
    id: `${overrides.weekday}-${overrides.opensAt}`,
    businessId: "biz-1",
    opensAt: "09:00",
    closesAt: "18:00",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

test("groups hours Monday-first with sorted ranges", () => {
  const days = groupHours([
    row({ weekday: 0, opensAt: "10:00", closesAt: "14:00" }),
    row({ weekday: 1, opensAt: "14:00", closesAt: "18:00" }),
    row({ weekday: 1, opensAt: "09:00", closesAt: "12:00" }),
  ])

  expect(days.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
  expect(days.map((day) => day.label)).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ])
  expect(days[0].ranges).toEqual([
    { opensAt: "09:00", closesAt: "12:00" },
    { opensAt: "14:00", closesAt: "18:00" },
  ])
  expect(days[6].ranges).toEqual([{ opensAt: "10:00", closesAt: "14:00" }])
})

test("leaves days with no rows empty", () => {
  const days = groupHours([])
  expect(days).toHaveLength(7)
  expect(days.every((day) => day.ranges.length === 0)).toBe(true)
})
