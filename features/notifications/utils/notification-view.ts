import type { InAppKind } from "@/types/in-app-notifications"
import type { BookingMessage } from "@/types/whatsapp"
import type { NotificationMessages } from "../i18n"
import type { InAppNotification } from "../types/notifications"

// Who a notification is about: the customer's name, else their number, else
// "a customer".
function who(item: InAppNotification, t: NotificationMessages) {
  const { customerName, customerPhone } = item.data
  if (customerName) return customerName
  if (customerPhone) return `+${customerPhone}`
  return t.someone
}

// A notification's short title, from its kind and facts, in the reader's
// language (N-D1).
export function titleOf(
  item: InAppNotification,
  t: NotificationMessages
): string {
  const number = new Intl.NumberFormat(t.locale)
  const message = () =>
    t.messages[item.data.message as BookingMessage] ?? t.aMessage
  switch (item.kind) {
    case "newBooking":
    case "customerCancelled":
    case "customerConfirmed":
    case "customerCantCome":
    case "customerReplied":
    case "messageFailed":
      return t.kinds[item.kind](who(item, t))
    case "templateApproved":
    case "templateRejected":
      return t.kinds[item.kind](message())
    case "koblipLimitNear":
      return t.kinds.koblipLimitNear(
        number.format(item.data.sent ?? 0),
        number.format(item.data.limit ?? 0)
      )
    case "koblipLimitReached":
    case "connectionRenew":
      return t.kinds[item.kind]
  }
}

// The calendar day of `iso` on this device (yyyy-mm-dd).
function dayOf(iso: string | number) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// The list in two groups, each still newest first: what happened today on
// this device's clock, and everything before. An empty group is left out.
export function groupByDay(items: InAppNotification[], now: number) {
  const today = dayOf(now)
  const groups = [
    {
      id: "today" as const,
      items: items.filter((item) => dayOf(item.at) === today),
    },
    {
      id: "earlier" as const,
      items: items.filter((item) => dayOf(item.at) !== today),
    },
  ]
  return groups.filter((group) => group.items.length > 0)
}

// New first page over what is shown: the newest from the server, then any
// older ones already loaded with "Show more".
export function mergePage(
  fresh: InAppNotification[],
  shown: InAppNotification[]
) {
  const ids = new Set(fresh.map((item) => item.id))
  const oldest = fresh.at(-1)?.at
  return [
    ...fresh,
    ...shown.filter(
      (item) => !ids.has(item.id) && (!oldest || item.at <= oldest)
    ),
  ]
}

// The choices screen's groups (N7), in order; every kind in one of them.
export const CHOICE_GROUPS = [
  {
    id: "bookings",
    kinds: [
      "newBooking",
      "customerConfirmed",
      "customerCantCome",
      "customerCancelled",
    ],
  },
  {
    id: "whatsapp",
    kinds: [
      "customerReplied",
      "messageFailed",
      "templateApproved",
      "templateRejected",
      "koblipLimitNear",
      "koblipLimitReached",
      "connectionRenew",
    ],
  },
] as const satisfies readonly { id: string; kinds: readonly InAppKind[] }[]
