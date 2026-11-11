import { BOOKING_EMAILS } from "@/lib/email-rules"
import type { EmailActivityFilter, EmailActivityState } from "@/types/email"

// The states the history can be filtered by, in the order they happen.
export const EMAIL_ACTIVITY_STATES: readonly EmailActivityState[] = [
  "pending",
  "sent",
  "failed",
  "skipped",
]

type Query = Record<string, string | string[] | undefined>

// The history's filters live in the address (?email=&state=&q=), as
// WhatsApp's Activity does, so Back brings a filtered list back. Unknown
// values are ignored.
export function emailFilterFrom(query: Query): EmailActivityFilter {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined
  return {
    kind: BOOKING_EMAILS.find((item) => item === one(query.email)),
    state: EMAIL_ACTIVITY_STATES.find((item) => item === one(query.state)),
    search: one(query.q)?.trim() || undefined,
  }
}

// The address for a filter: only the parts that are set.
export function emailFilterQuery(filter: EmailActivityFilter): string {
  const query = new URLSearchParams()
  if (filter.kind) query.set("email", filter.kind)
  if (filter.state) query.set("state", filter.state)
  if (filter.search) query.set("q", filter.search)
  const text = query.toString()
  return text ? `?${text}` : ""
}
