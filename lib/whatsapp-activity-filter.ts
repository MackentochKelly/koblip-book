import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type { ActivityFilter, ActivityState } from "@/types/whatsapp"

export const ACTIVITY_STATES: readonly ActivityState[] = [
  "pending",
  "sending",
  "sent",
  "read",
  "replied",
  "failed",
  "skipped",
]

type Query = Record<string, string | string[] | undefined>

// Activity's filters, on the business page and in the admin, live in the
// address (?message=&state=&q=), so a filtered list can be shared and Back
// brings it back. Unknown values are ignored.
export function activityFilterFrom(query: Query): ActivityFilter {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined
  return {
    message: BOOKING_MESSAGES.find((item) => item === one(query.message)),
    state: ACTIVITY_STATES.find((item) => item === one(query.state)),
    search: one(query.q)?.trim() || undefined,
  }
}

// The address for a filter: only the parts that are set.
export function activityQuery(filter: ActivityFilter): string {
  const query = new URLSearchParams()
  if (filter.message) query.set("message", filter.message)
  if (filter.state) query.set("state", filter.state)
  if (filter.search) query.set("q", filter.search)
  const text = query.toString()
  return text ? `?${text}` : ""
}
