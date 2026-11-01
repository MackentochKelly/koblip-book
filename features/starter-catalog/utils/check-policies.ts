import { POLICY_KINDS, POLICY_RULES, type PolicyKind } from "@/lib/policy-rules"

export type DraftPolicies = Record<PolicyKind, string>

// Things a draft must never hold: blanks left to fill in, Markdown the page
// would show as symbols, or money the app never takes.
const FORBIDDEN: Array<{ pattern: RegExp; problem: string }> = [
  { pattern: /\[[^\]]*\]|\{[^}]*\}|_{3,}/, problem: "leaves a blank to fill in" },
  { pattern: /^\s*#|\*\*|__/m, problem: "uses Markdown symbols" },
  {
    pattern: /\b(deposit|card on file|credit card|charge[sd]?|fee|refund)\b/i,
    problem: "mentions a deposit, card, fee, charge or refund (nothing is paid online)",
  },
]

// Muse's policies checked with fixed rules: each one there, plain text,
// within length, nothing to fill in, no payments. Problems go back to Muse.
export function checkPolicies(
  value: unknown
): { ok: true; policies: DraftPolicies } | { ok: false; problems: string[] } {
  if (!value || typeof value !== "object") {
    return { ok: false, problems: ["Answer with booking, terms and privacy."] }
  }
  const draft = value as Record<string, unknown>
  const problems: string[] = []
  const policies = {} as DraftPolicies
  for (const kind of POLICY_KINDS) {
    const text = typeof draft[kind] === "string" ? draft[kind].trim() : ""
    if (text.length < POLICY_RULES.minDraftLength) {
      problems.push(`${kind} is missing or under ${POLICY_RULES.minDraftLength} characters.`)
    } else if (text.length > POLICY_RULES.maxLength) {
      problems.push(`${kind} is over ${POLICY_RULES.maxLength} characters.`)
    }
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) problems.push(`${kind} ${rule.problem}.`)
    }
    policies[kind] = text
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, policies }
}
