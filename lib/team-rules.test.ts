import { expect, test } from "vitest"

import {
  checkStartingCounts,
  isTeamColor,
  randomStartingCounts,
  TEAM_COLORS,
  TEAM_RULES,
  teamColorOf,
} from "./team-rules"

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

test("a team member shows in the colour picked for them", () => {
  expect(teamColorOf("purple", 0)).toBe("purple")
  expect(isTeamColor("purple")).toBe(true)
})

test("with no colour picked, each place in the team gets its own", () => {
  const colors = TEAM_COLORS.map((_, index) => teamColorOf(null, index))
  expect(new Set(colors).size).toBe(TEAM_COLORS.length)
  // More people than colours start over from the first.
  expect(teamColorOf(null, TEAM_COLORS.length)).toBe(TEAM_COLORS[0])
})

test("a colour that is not on the list falls back to the place's colour", () => {
  expect(isTeamColor("#ff0000")).toBe(false)
  expect(teamColorOf("#ff0000", 1)).toBe(TEAM_COLORS[1])
  expect(teamColorOf(undefined, -3)).toBe(TEAM_COLORS[0])
})
