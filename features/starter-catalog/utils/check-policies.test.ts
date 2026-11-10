import { expect, test } from "vitest"
import { checkPolicies } from "./check-policies"

const good = "We are happy to see you. ".repeat(10).trim()
const points = [
  { icon: "calendar", title: "Cancelling", body: "Tell us a day ahead." },
  { icon: "clock", title: "Arriving", body: "Come five minutes early." },
  { icon: "card", title: "Paying", body: "Pay at the shop after your visit." },
]

test("checkPolicies accepts three plain policies and their points, trimmed", () => {
  const result = checkPolicies({
    booking: ` ${good} `,
    terms: good,
    privacy: good,
    points: [{ ...points[0], title: " Cancelling " }, ...points.slice(1)],
  })
  expect(result).toEqual({
    ok: true,
    policies: { texts: { booking: good, terms: good, privacy: good }, points },
  })
})

test("checkPolicies sends back what is wrong", () => {
  const result = checkPolicies({
    booking: "Too short.",
    terms: `${good} A deposit is needed.`,
    privacy: `${good} Email us at [email].`,
    points,
  })
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.problems).toHaveLength(3)
  expect(result.problems[0]).toMatch(/^booking is missing or under/)
  expect(result.problems[1]).toMatch(/^terms mentions a deposit/)
  expect(result.problems[2]).toMatch(/^privacy leaves a blank/)
})

test("checkPolicies checks the points' count, icons, lengths and money", () => {
  const texts = { booking: good, terms: good, privacy: good }
  const few = checkPolicies({ ...texts, points: points.slice(0, 2) })
  expect(few.ok).toBe(false)
  const bad = checkPolicies({
    ...texts,
    points: [
      { icon: "rocket", title: "Fun", body: "Hi." },
      { icon: "card", title: "x".repeat(41), body: "Hi." },
      { icon: "card", title: "Deposit", body: "A deposit holds your time." },
    ],
  })
  expect(bad.ok).toBe(false)
  if (bad.ok) return
  expect(bad.problems).toEqual([
    "point 1 needs an icon from the list.",
    "point 2 title must be 1 to 40 characters.",
    "point 3 mentions a deposit, card, fee, charge or refund (the business has none).",
  ])
})

test("checkPolicies rejects an answer that is not an object", () => {
  expect(checkPolicies(null).ok).toBe(false)
})
