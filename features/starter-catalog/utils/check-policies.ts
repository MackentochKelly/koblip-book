import {
  isPolicyPointIcon,
  POLICY_KINDS,
  POLICY_RULES,
  type PolicyKind,
  type PolicyPointIcon,
} from "@/lib/policy-rules"

export interface DraftPolicyPoint {
  icon: PolicyPointIcon
  title: string
  body: string
}

export interface DraftPolicies {
  texts: Record<PolicyKind, string>
  points: DraftPolicyPoint[]
}

// Things a policy must never hold, however it was written: blanks left to
// fill in, or Markdown the page would show as symbols.
const FORMAT: Array<{ pattern: RegExp; problem: string }> = [
  { pattern: /\[[^\]]*\]|\{[^}]*\}|_{3,}/, problem: "leaves a blank to fill in" },
  { pattern: /^\s*#|\*\*|__/m, problem: "uses Markdown symbols" },
]

// And what a first draft must not hold either: money the app never takes
// and the business never told us about.
const MONEY: Array<{ pattern: RegExp; problem: string }> = [
  {
    pattern: /\b(deposit|card on file|credit card|charge[sd]?|fee|refund)\b/i,
    problem: "mentions a deposit, card, fee, charge or refund (the business has none)",
  },
]

function problemsOf(
  rules: typeof FORMAT,
  label: string,
  text: string
): string[] {
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => `${label} ${rule.problem}.`)
}

// For a text Muse changed but did not write from nothing: the owner's own
// words may rightly mention a fee.
export function formatProblems(label: string, text: string): string[] {
  return problemsOf(FORMAT, label, text)
}

function forbidden(label: string, text: string): string[] {
  return problemsOf([...FORMAT, ...MONEY], label, text)
}

function checkPoints(value: unknown, problems: string[]): DraftPolicyPoint[] {
  const raw = Array.isArray(value) ? value : []
  if (
    raw.length < POLICY_RULES.minDraftPoints ||
    raw.length > POLICY_RULES.maxPoints
  ) {
    problems.push(
      `points must have ${POLICY_RULES.minDraftPoints} to ${POLICY_RULES.maxPoints} items.`
    )
  }
  return raw.slice(0, POLICY_RULES.maxPoints).map((item: unknown, index) => {
    const point = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >
    const label = `point ${index + 1}`
    const title = typeof point.title === "string" ? point.title.trim() : ""
    const body = typeof point.body === "string" ? point.body.trim() : ""
    if (!isPolicyPointIcon(point.icon)) {
      problems.push(`${label} needs an icon from the list.`)
    }
    if (title === "" || title.length > POLICY_RULES.maxPointTitle) {
      problems.push(`${label} title must be 1 to ${POLICY_RULES.maxPointTitle} characters.`)
    }
    if (body === "" || body.length > POLICY_RULES.maxPointBody) {
      problems.push(`${label} text must be 1 to ${POLICY_RULES.maxPointBody} characters.`)
    }
    problems.push(...forbidden(label, `${title}\n${body}`))
    return {
      icon: isPolicyPointIcon(point.icon) ? point.icon : "info",
      title,
      body,
    }
  })
}

// Muse's policies checked with fixed rules: each text there, plain, within
// length, nothing to fill in, no payments; and 3 or 4 short key points.
// Problems go back to Muse.
export function checkPolicies(
  value: unknown
): { ok: true; policies: DraftPolicies } | { ok: false; problems: string[] } {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      problems: ["Answer with booking, terms, privacy and points."],
    }
  }
  const draft = value as Record<string, unknown>
  const problems: string[] = []
  const texts = {} as Record<PolicyKind, string>
  for (const kind of POLICY_KINDS) {
    const text = typeof draft[kind] === "string" ? draft[kind].trim() : ""
    if (text.length < POLICY_RULES.minDraftLength) {
      problems.push(`${kind} is missing or under ${POLICY_RULES.minDraftLength} characters.`)
    } else if (text.length > POLICY_RULES.maxLength) {
      problems.push(`${kind} is over ${POLICY_RULES.maxLength} characters.`)
    }
    problems.push(...forbidden(kind, text))
    texts[kind] = text
  }
  const points = checkPoints(draft.points, problems)
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, policies: { texts, points } }
}
