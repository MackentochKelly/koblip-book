import { expect, test } from "vitest"
import { availability, type AvailabilityInput } from "./availability"

const TZ = "America/Santo_Domingo"
// Monday 2026-06-01 08:00 local (12:00 UTC); cutoff 09:00 local.
const MONDAY_NOON = Date.UTC(2026, 5, 1, 12, 0)

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    hours: [
      { weekday: 1, opensAt: "09:00", closesAt: "18:00" },
      { weekday: 2, opensAt: "09:00", closesAt: "18:00" },
      { weekday: 3, opensAt: "09:00", closesAt: "18:00" },
      { weekday: 4, opensAt: "09:00", closesAt: "18:00" },
      { weekday: 5, opensAt: "09:00", closesAt: "18:00" },
    ],
    timeZone: TZ,
    durationMinutes: 60,
    seats: 1,
    teamMemberIds: [],
    taken: [],
    now: MONDAY_NOON,
    dates: ["2026-06-01"],
    ...overrides,
  }
}

test("normal day lists every slot start", () => {
  const [day] = availability(base())
  expect(day.date).toBe("2026-06-01")
  expect(day.times[0]).toBe("09:00")
  expect(day.times[day.times.length - 1]).toBe("17:00")
  expect(day.times).toHaveLength(33)
  expect(day.times).toContain("09:15")
})

test("closed day stays in the list with no times", () => {
  const [day] = availability(base({ dates: ["2026-06-07"] }))
  expect(day).toEqual({ date: "2026-06-07", times: [] })
})

test("24-hour day covers the whole day", () => {
  const [day] = availability(
    base({
      hours: [{ weekday: 1, opensAt: "00:00", closesAt: "00:00" }],
      now: Date.UTC(2026, 4, 30, 12, 0),
    })
  )
  expect(day.times[0]).toBe("00:00")
  expect(day.times[day.times.length - 1]).toBe("23:00")
  expect(day.times).toHaveLength(93)
})

test("overnight row covers both days", () => {
  const input = base({
    hours: [{ weekday: 5, opensAt: "20:00", closesAt: "02:00" }],
    durationMinutes: 30,
    seats: 5,
    now: Date.UTC(2026, 5, 1, 12, 0),
    dates: ["2026-06-05", "2026-06-06"],
  })
  const [friday, saturday] = availability(input)
  expect(friday.times[0]).toBe("20:00")
  expect(friday.times[friday.times.length - 1]).toBe("23:30")
  expect(saturday.times[0]).toBe("00:00")
  expect(saturday.times[saturday.times.length - 1]).toBe("01:30")
})

test("minimum notice skips early starts", () => {
  const [day] = availability(
    base({
      durationMinutes: 30,
      now: Date.UTC(2026, 5, 1, 12, 30),
    })
  )
  expect(day.times[0]).toBe("09:30")
})

test("service longer than the stretch has no times", () => {
  const [day] = availability(
    base({
      hours: [{ weekday: 1, opensAt: "09:00", closesAt: "10:00" }],
      durationMinutes: 90,
    })
  )
  expect(day.times).toEqual([])
})

test("seats 1 blocks the overlap, seats 2 keeps it", () => {
  const taken = [
    {
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      teamMemberId: null,
    },
  ]
  const oneSeat = availability(
    base({ durationMinutes: 30, taken, dates: ["2026-06-01"] })
  )[0]
  expect(oneSeat.times).toContain("09:30")
  expect(oneSeat.times).not.toContain("10:00")
  expect(oneSeat.times).not.toContain("10:45")
  expect(oneSeat.times).toContain("11:00")

  const twoSeats = availability(
    base({ durationMinutes: 30, taken, seats: 2, dates: ["2026-06-01"] })
  )[0]
  expect(twoSeats.times).toContain("10:00")
})

test("team anyone stays free while one member is free", () => {
  const taken = [
    {
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      teamMemberId: "m1",
    },
  ]
  const [day] = availability(
    base({ durationMinutes: 30, taken, teamMemberIds: ["m1", "m2"] })
  )
  expect(day.times).toContain("10:00")
})

test("chosen busy person is not free", () => {
  const taken = [
    {
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      teamMemberId: "m1",
    },
  ]
  const [day] = availability(
    base({ durationMinutes: 30, taken, teamMemberIds: ["m1"] })
  )
  expect(day.times).not.toContain("10:00")
})

test("null-member booking blocks the only member", () => {
  const taken = [
    {
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      teamMemberId: null,
    },
  ]
  const [one] = availability(
    base({ durationMinutes: 30, taken, teamMemberIds: ["m1"] })
  )
  expect(one.times).not.toContain("10:00")
  const [two] = availability(
    base({ durationMinutes: 30, taken, teamMemberIds: ["m1", "m2"] })
  )
  expect(two.times).toContain("10:00")
})

test("cancelled bookings are simply not passed in", () => {
  const [day] = availability(base({ durationMinutes: 30, taken: [] }))
  expect(day.times).toContain("10:00")
})
