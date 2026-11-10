import { POLICY_RULES } from "@/lib/policy-rules"
import { formatProblems } from "./check-policies"

// A business's policies as they stand, for Muse to bring up to date.
export interface CurrentPolicies {
  policies: Array<{ id: string; body: string }>
  points: Array<{ id: string; title: string; body: string }>
}

// The texts Muse changed; the ones it left alone are not here.
export type PolicyRewrite = CurrentPolicies

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

// Muse's changed texts checked with fixed rules: each is one of the
// business's own, still there, plain and within length. A text that came
// back the same is dropped. Problems go back to Muse.
export function checkPolicyRewrite(
  value: unknown,
  current: CurrentPolicies
): { ok: true; rewrite: PolicyRewrite } | { ok: false; problems: string[] } {
  const answer = record(value)
  if (!Array.isArray(answer.policies) || !Array.isArray(answer.points)) {
    return { ok: false, problems: ["Answer with policies and points."] }
  }
  const problems: string[] = []
  const rewrite: PolicyRewrite = { policies: [], points: [] }
  for (const item of answer.policies.map(record)) {
    const before = current.policies.find((policy) => policy.id === item.id)
    const label = `policy ${String(item.id)}`
    if (!before) {
      problems.push(`${label} is not one of the policies given.`)
      continue
    }
    const body = text(item.body)
    if (body === "" || body.length > POLICY_RULES.maxLength) {
      problems.push(`${label} must be 1 to ${POLICY_RULES.maxLength} characters.`)
    }
    problems.push(...formatProblems(label, body))
    if (body !== before.body) rewrite.policies.push({ id: before.id, body })
  }
  for (const item of answer.points.map(record)) {
    const before = current.points.find((point) => point.id === item.id)
    const label = `point ${String(item.id)}`
    if (!before) {
      problems.push(`${label} is not one of the points given.`)
      continue
    }
    const title = text(item.title)
    const body = text(item.body)
    if (title === "" || title.length > POLICY_RULES.maxPointTitle) {
      problems.push(`${label} title must be 1 to ${POLICY_RULES.maxPointTitle} characters.`)
    }
    if (body === "" || body.length > POLICY_RULES.maxPointBody) {
      problems.push(`${label} text must be 1 to ${POLICY_RULES.maxPointBody} characters.`)
    }
    problems.push(...formatProblems(label, `${title}\n${body}`))
    if (title !== before.title || body !== before.body) {
      rewrite.points.push({ id: before.id, title, body })
    }
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, rewrite }
}
