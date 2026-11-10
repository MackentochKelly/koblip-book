import { expect, test } from "vitest"
import { POLICY_RULES } from "@/lib/policy-rules"
import { checkPolicyRewrite } from "./check-policy-rewrite"

const current = {
  policies: [
    { id: "p1", body: "Book online. You pay at the salon." },
    { id: "p2", body: "A late fee may apply." },
  ],
  points: [{ id: "k1", title: "Pay at salon", body: "You pay at the salon." }],
}

test("keeps only the texts that changed, trimmed", () => {
  const result = checkPolicyRewrite(
    {
      policies: [
        { id: "p1", body: " Book online. You pay us directly. " },
        { id: "p2", body: "A late fee may apply." },
      ],
      points: [{ id: "k1", title: "Paying", body: "You pay us directly." }],
    },
    current
  )
  expect(result).toEqual({
    ok: true,
    rewrite: {
      policies: [{ id: "p1", body: "Book online. You pay us directly." }],
      points: [{ id: "k1", title: "Paying", body: "You pay us directly." }],
    },
  })
})

test("nothing about paying to change is fine", () => {
  expect(checkPolicyRewrite({ policies: [], points: [] }, current)).toEqual({
    ok: true,
    rewrite: { policies: [], points: [] },
  })
})

test("the owner's own words may mention a fee", () => {
  const result = checkPolicyRewrite(
    { policies: [{ id: "p2", body: "A late fee may apply. Pay us directly." }], points: [] },
    current
  )
  expect(result.ok).toBe(true)
})

test("sends back what is wrong", () => {
  const result = checkPolicyRewrite(
    {
      policies: [
        { id: "nope", body: "Hello." },
        { id: "p1", body: "" },
        { id: "p2", body: "Pay to [account]." },
      ],
      points: [
        { id: "k1", title: "x".repeat(POLICY_RULES.maxPointTitle + 1), body: "**Pay**" },
      ],
    },
    current
  )
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.problems).toEqual([
    "policy nope is not one of the policies given.",
    `policy p1 must be 1 to ${POLICY_RULES.maxLength} characters.`,
    "policy p2 leaves a blank to fill in.",
    `point k1 title must be 1 to ${POLICY_RULES.maxPointTitle} characters.`,
    "point k1 uses Markdown symbols.",
  ])
})

test("an answer without both lists is refused", () => {
  expect(checkPolicyRewrite({ policies: [] }, current).ok).toBe(false)
  expect(checkPolicyRewrite(null, current).ok).toBe(false)
})
