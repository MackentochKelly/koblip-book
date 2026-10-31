import { IN_APP_KINDS, type InAppKind } from "@/types/in-app-notifications"

export type NotificationReadFilter = "unread" | "read"

export const NOTIFICATION_READ_FILTERS: readonly NotificationReadFilter[] = ["unread", "read"]

// The admin's Notifications filters (N6), in the address
// (?business=&kind=&read=) like Activity's, so Back brings them back.
export type NotificationFilter = {
  businessId?: string
  kind?: InAppKind
  read?: NotificationReadFilter
}

type Query = Record<string, string | string[] | undefined>

// Unknown values are ignored.
export function notificationFilterFrom(query: Query): NotificationFilter {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined
  return {
    businessId: one(query.business) || undefined,
    kind: IN_APP_KINDS.find((item) => item === one(query.kind)),
    read: NOTIFICATION_READ_FILTERS.find((item) => item === one(query.read)),
  }
}

// The address for a filter: only the parts that are set.
export function notificationQuery(filter: NotificationFilter): string {
  const query = new URLSearchParams()
  if (filter.businessId) query.set("business", filter.businessId)
  if (filter.kind) query.set("kind", filter.kind)
  if (filter.read) query.set("read", filter.read)
  const text = query.toString()
  return text ? `?${text}` : ""
}
