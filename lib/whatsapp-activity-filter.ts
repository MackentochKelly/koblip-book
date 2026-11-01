import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type {
  ActivityFilter,
  ActivityRun,
  ActivityState,
} from "@/types/whatsapp"

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

// The message filter's value for automation runs (D18).
export const AUTOMATIONS = "automations"

// Activity's filters, on the business page and in the admin, live in the
// address (?message=&state=&q=; message=automations for runs only), so a
// filtered list can be shared and Back brings it back. Unknown values are
// ignored.
export function activityFilterFrom(query: Query): ActivityFilter {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined
  return {
    message: BOOKING_MESSAGES.find((item) => item === one(query.message)),
    automations: one(query.message) === AUTOMATIONS || undefined,
    state: ACTIVITY_STATES.find((item) => item === one(query.state)),
    search: one(query.q)?.trim() || undefined,
  }
}

// The address for a filter: only the parts that are set.
export function activityQuery(filter: ActivityFilter): string {
  const query = new URLSearchParams()
  if (filter.message) query.set("message", filter.message)
  else if (filter.automations) query.set("message", AUTOMATIONS)
  if (filter.state) query.set("state", filter.state)
  if (filter.search) query.set("q", filter.search)
  const text = query.toString()
  return text ? `?${text}` : ""
}

// A run's states; any other state filter shows no runs.
const RUN_STATES: readonly ActivityRun["state"][] = [
  "sent",
  "failed",
  "skipped",
]

// What a filter loads (D18 of the automations plan): booking messages unless
// only automations are asked for; runs, with the state they can match,
// unless one booking message or a state runs don't have is asked for.
export function activitySources(filter: ActivityFilter): {
  messages: boolean
  runs: { state?: ActivityRun["state"]; search?: string } | null
} {
  const state = RUN_STATES.find((item) => item === filter.state)
  return {
    messages: !filter.automations,
    runs:
      !filter.message && (!filter.state || state)
        ? { state, search: filter.search }
        : null,
  }
}
