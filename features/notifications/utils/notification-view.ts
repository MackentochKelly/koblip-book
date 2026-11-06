import type {
  ClientInAppKind,
  OwnerInAppKind,
} from "@/types/in-app-notifications"
import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type { BookingMessage } from "@/types/whatsapp"
import type {
  InAppNotification,
  NotificationWords,
} from "../types/notifications"

function isBookingMessage(value: string | undefined): value is BookingMessage {
  return BOOKING_MESSAGES.some((message) => message === value)
}

// Who a notification is about: the customer's name, else their number, else
// "a customer".
function who(item: InAppNotification, t: NotificationWords) {
  const { customerName, customerPhone } = item.data
  if (customerName) return customerName
  if (customerPhone) return `+${customerPhone}`
  return t("someone")
}

// A notification's short title, from its kind and facts, in the reader's
// language (N-D1); numbers read as in `locale`.
export function titleOf(
  item: InAppNotification,
  t: NotificationWords,
  locale: string
): string {
  const number = new Intl.NumberFormat(locale)
  const message = () => {
    const { message } = item.data
    return isBookingMessage(message) ? t(`messages.${message}`) : t("aMessage")
  }
  switch (item.kind) {
    case "newBooking":
    case "customerCancelled":
    case "customerConfirmed":
    case "customerCantCome":
    case "customerMoved":
    case "customerReplied":
    case "messageFailed":
      return t(`kinds.${item.kind}`, { who: who(item, t) })
    case "templateApproved":
    case "templateRejected":
      return t(`kinds.${item.kind}`, { message: message() })
    case "koblipLimitNear":
      return t("kinds.koblipLimitNear", {
        sent: number.format(item.data.sent ?? 0),
        limit: number.format(item.data.limit ?? 0),
      })
    case "koblipLimitReached":
    case "connectionRenew":
      return t(`kinds.${item.kind}`)
    case "clientBooked":
    case "clientMoved":
    case "clientCancelled":
    case "clientReminder":
      return t(`kinds.${item.kind}`, {
        service: item.data.serviceName ?? "",
        when: whenOf(item, locale),
      })
  }
}

// The visit's day and time, in the business's time zone.
function whenOf(item: InAppNotification, locale: string) {
  if (!item.data.startAt) return ""
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: item.timezone,
  }).format(new Date(item.data.startAt))
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

export type ChoiceGroup<Kind extends string> = {
  id: "bookings" | "whatsapp" | "visits"
  kinds: readonly Kind[]
}

// The owner's choices screen's groups (N7), in order; every owner kind in
// one of them.
export const CHOICE_GROUPS = [
  {
    id: "bookings",
    kinds: [
      "newBooking",
      "customerConfirmed",
      "customerCantCome",
      "customerMoved",
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
] as const satisfies readonly ChoiceGroup<OwnerInAppKind>[]

// The client's, in their account's Settings (client account D10).
export const CLIENT_CHOICE_GROUPS = [
  {
    id: "visits",
    kinds: ["clientBooked", "clientMoved", "clientCancelled", "clientReminder"],
  },
] as const satisfies readonly ChoiceGroup<ClientInAppKind>[]
