import { expect, test } from "vitest"

import { checkStartingCounts, randomStartingCounts, TEAM_RULES } from "./team-rules"

test("random starting numbers stay in range, clients never more than appointments", () => {
  const { min, max } = TEAM_RULES.startingCounts
  for (let i = 0; i < 500; i++) {
    const { pastAppointments, pastClients } = randomStartingCounts()
    expect(Number.isInteger(pastAppointments)).toBe(true)
    expect(pastAppointments).toBeGreaterThanOrEqual(min)
    expect(pastAppointments).toBeLessThanOrEqual(max)
    expect(pastClients).toBeGreaterThanOrEqual(min)
    expect(pastClients).toBeLessThanOrEqual(pastAppointments)
  }
})

test("checkStartingCounts takes own numbers or 0", () => {
  expect(checkStartingCounts({ pastAppointments: 0, pastClients: 0 })).toEqual({
    ok: true,
    values: { pastAppointments: 0, pastClients: 0 },
  })
  expect(checkStartingCounts({ pastAppointments: 300, pastClients: 120 }).ok).toBe(true)
})

test("checkStartingCounts refuses more clients than appointments, negatives and fractions", () => {
  const bad = { ok: false, error: "counts" }
  expect(checkStartingCounts({ pastAppointments: 10, pastClients: 11 })).toEqual(bad)
  expect(checkStartingCounts({ pastAppointments: -1, pastClients: 0 })).toEqual(bad)
  expect(checkStartingCounts({ pastAppointments: 1.5, pastClients: 0 })).toEqual(bad)
  expect(
    checkStartingCounts({
      pastAppointments: TEAM_RULES.startingCounts.highest + 1,
      pastClients: 0,
    })
  ).toEqual(bad)
  expect(checkStartingCounts(null)).toEqual(bad)
})
