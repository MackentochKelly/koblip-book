import { expect, test } from "vitest"
import { checkPolicies } from "./check-policies"

const good = "We are happy to see you. ".repeat(10).trim()

test("checkPolicies accepts three plain policies and trims them", () => {
  const result = checkPolicies({ booking: ` ${good} `, terms: good, privacy: good })
  expect(result).toEqual({
    ok: true,
    policies: { booking: good, terms: good, privacy: good },
  })
})

test("checkPolicies sends back what is wrong", () => {
  const result = checkPolicies({
    booking: "Too short.",
    terms: `${good} A deposit is needed.`,
    privacy: `${good} Email us at [email].`,
  })
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.problems).toHaveLength(3)
  expect(result.problems[0]).toMatch(/^booking is missing or under/)
  expect(result.problems[1]).toMatch(/^terms mentions a deposit/)
  expect(result.problems[2]).toMatch(/^privacy leaves a blank/)
})

test("checkPolicies rejects an answer that is not an object", () => {
  expect(checkPolicies(null).ok).toBe(false)
})
