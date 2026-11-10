import "server-only"
import { and, eq, gt, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { bookings, businesses, inAppNotificationSettings, inAppNotifications, reviews, user } from "@/lib/db/schema"
import { ACCOUNT_REWARDS_PATH, accountBookingHref } from "@/lib/my-bookings-links"
import { notificationRules } from "@/lib/platform-settings"
import { REVIEW_RULES } from "@/lib/review-rules"
import type { ClientInAppKind, InAppData, OwnerInAppKind } from "@/types/in-app-notifications"

// Creating the owner's in-app notifications (docs/plans/in-app-notifications.md,
// N-D2): one shared function, called where each event already happens. The
// bell reads them through features/notifications.

// Where each kind opens, in the business's owner area.
const LINKS: Record<OwnerInAppKind, string> = {
  newBooking: "",
  customerCancelled: "",
  customerConfirmed: "",
  customerCantCome: "",
  customerMoved: "",
  customerPaid: "/bookings",
  customerReplied: "/automations/activity",
  messageFailed: "/automations/activity",
  templateApproved: "/automations/messages",
  templateRejected: "/automations/messages",
  koblipLimitNear: "/automations",
  koblipLimitReached: "/automations",
  connectionRenew: "/integrations",
}

export function inAppLink(businessId: string, kind: OwnerInAppKind) {
  return `/dashboard/${businessId}${LINKS[kind]}`
}

export type NotifyOptions = {
  // One notification per key and business: a repeat changes nothing.
  dedupeKey?: string
  // With a key, a repeat makes the one notification new and unread again,
  // with the latest facts (a customer who writes again).
  renew?: boolean
}

// The writes for one notification, to save together with what caused it
// (saveAll): none when none is due (a demo copy, or a kind the owner turned
// off). A list, since a query builder returned from an async function would
// run there and then.
export async function notification(
  businessId: string,
  kind: OwnerInAppKind,
  data: InAppData,
  { dedupeKey, renew = false }: NotifyOptions = {}
): Promise<BatchItem<"sqlite">[]> {
  const [row] = await db
    .select({ isDemo: businesses.isDemo, turnedOff: inAppNotificationSettings.turnedOff })
    .from(businesses)
    .leftJoin(inAppNotificationSettings, eq(inAppNotificationSettings.businessId, businesses.id))
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!row || row.isDemo || row.turnedOff?.includes(kind)) return []
  const insert = db
    .insert(inAppNotifications)
    .values({ businessId, kind, data, link: inAppLink(businessId, kind), dedupeKey })
  if (!dedupeKey) return [insert]
  return [
    renew
      ? insert.onConflictDoUpdate({
          target: [inAppNotifications.businessId, inAppNotifications.dedupeKey],
          set: { data, readAt: null, createdAt: sql`excluded.created_at` },
        })
      : insert.onConflictDoNothing(),
  ]
}

// The same, saved on its own: for an event that has nothing else to save.
export async function notify(
  businessId: string,
  kind: OwnerInAppKind,
  data: InAppData,
  options?: NotifyOptions
) {
  await saveAll(await notification(businessId, kind, data, options))
}

// The client's bell (docs/plans/client-account.md, D10): what the business
// did with a booking, for the account that owns it. Saved only when an
// account can own it (made or claimed with one, or made with a phone an
// account has proved), once per booking, kind and move.

type ClientBooking = Pick<
  typeof bookings.$inferSelect,
  "id" | "businessId" | "moves" | "serviceName" | "startAt" | "customerUserId" | "customerKey"
>


// The customer key an account's proved phone gives (lib/customer-key.ts):
// "p:" and the phone's digits.
const phoneKey = sql<string>`'p:' || replace(${user.phoneNumber}, '+', '')`

// Whether some account owns bookings with this customer key.
function accountHasKey(key: string) {
  return db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.phoneNumberVerified, true), eq(phoneKey, key)))
    .limit(1)
}

function clientInsert(
  booking: ClientBooking,
  kind: Exclude<ClientInAppKind, "clientRewardEarned">
) {
  return db
    .insert(inAppNotifications)
    .values({
      businessId: booking.businessId,
      kind,
      audience: "client",
      bookingId: booking.id,
      data: { serviceName: booking.serviceName, startAt: booking.startAt },
      // The booking's own page in the client account (D11).
      link: accountBookingHref(booking.id),
      dedupeKey: `client:${kind}:${booking.id}:${booking.moves}`,
    })
    .onConflictDoNothing()
}

// The writes for one client notification, to save with what caused it (a
// list, as for `notification`): none for a demo copy or a booking no
// account can own. `booking` is as it is after the change.
export async function clientNotification(
  booking: ClientBooking,
  kind: Exclude<ClientInAppKind, "clientRewardEarned">
): Promise<BatchItem<"sqlite">[]> {
  return (await clientCanHear(booking)) ? [clientInsert(booking, kind)] : []
}

// Whether a client's bell can show something about this booking: never a
// demo copy, and only a booking some account owns.
async function clientCanHear(
  booking: Pick<ClientBooking, "businessId" | "customerUserId" | "customerKey">
) {
  const [business] = await db
    .select({ isDemo: businesses.isDemo })
    .from(businesses)
    .where(eq(businesses.id, booking.businessId))
    .limit(1)
  if (!business || business.isDemo) return false
  if (booking.customerUserId) return true
  if (!booking.customerKey?.startsWith("p:")) return false
  const [owner] = await accountHasKey(booking.customerKey)
  return !!owner
}

// The writes that tell a client they earned a reward
// (docs/plans/rewards.md, RW-11), to save with the reward itself. It
// rides on one of their bookings at the business, which is how the bell
// knows whose it is, and opens their Rewards page. `once` names what made
// the reward, so the same one is never told twice.
export async function clientRewardNotification(
  booking: Pick<
    ClientBooking,
    "id" | "businessId" | "customerUserId" | "customerKey"
  >,
  once: string
): Promise<BatchItem<"sqlite">[]> {
  if (!(await clientCanHear(booking))) return []
  return [
    db
      .insert(inAppNotifications)
      .values({
        businessId: booking.businessId,
        kind: "clientRewardEarned",
        audience: "client",
        bookingId: booking.id,
        data: {},
        link: ACCOUNT_REWARDS_PATH,
        dedupeKey: `client:clientRewardEarned:${once}`,
      })
      .onConflictDoNothing(),
  ]
}

// The reminder before each visit within the admin's
// `clientReminderMinutes`, for bookings an account owns, made before that
// time began; the server's timer calls this on each check.
export async function remindClients(now = new Date()) {
  const { clientReminderMinutes } = await notificationRules()
  const lead = clientReminderMinutes * 60_000
  const due = await db
    .select({
      id: bookings.id,
      businessId: bookings.businessId,
      moves: bookings.moves,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      customerUserId: bookings.customerUserId,
      customerKey: bookings.customerKey,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        eq(businesses.isDemo, false),
        ne(bookings.status, "cancelled"),
        gt(bookings.startAt, now.toISOString()),
        lte(bookings.startAt, new Date(now.getTime() + lead).toISOString()),
        // Booked or moved after the reminder's time began: just told.
        lte(bookings.updatedAt, sql`strftime('%Y-%m-%dT%H:%M:%fZ', ${bookings.startAt}, ${`-${clientReminderMinutes} minutes`})`),
        accountOwned()
      )
    )
  await saveAll(due.map((booking) => clientInsert(booking, "clientReminder")))
}

// Bookings some account owns: made or claimed with one, or made with a
// phone an account has proved.
function accountOwned() {
  return or(
    isNotNull(bookings.customerUserId),
    sql`${bookings.customerKey} in (select ${phoneKey} from ${user} where ${user.phoneNumberVerified} = 1)`
  )
}

// The nudge to rate a visit (D15), `askAfterHours` after it ended, for
// visits that ended within `askWithinDays`, weren't cancelled or missed,
// and have no review yet; the server's timer calls this on each check.
export async function askForReviews(now = new Date()) {
  const { askAfterHours, askWithinDays } = REVIEW_RULES
  const due = await db
    .select({
      id: bookings.id,
      businessId: bookings.businessId,
      moves: bookings.moves,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      customerUserId: bookings.customerUserId,
      customerKey: bookings.customerKey,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(
      and(
        eq(businesses.isDemo, false),
        notInArray(bookings.status, ["cancelled", "no_show"]),
        lte(bookings.endAt, new Date(now.getTime() - askAfterHours * 3_600_000).toISOString()),
        gt(bookings.endAt, new Date(now.getTime() - askWithinDays * 86_400_000).toISOString()),
        isNull(reviews.id),
        accountOwned()
      )
    )
  await saveAll(due.map((booking) => clientInsert(booking, "clientReviewAsk")))
}

// Notifications older than the admin's `inAppKeepDays`, read or not, are
// removed (N5); the server's timer calls this on each check.
export async function removeOldNotifications(now = new Date()) {
  const { inAppKeepDays } = await notificationRules()
  const before = new Date(now.getTime() - inAppKeepDays * 86_400_000).toISOString()
  await db.delete(inAppNotifications).where(lt(inAppNotifications.createdAt, before))
}
