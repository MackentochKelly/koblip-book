"use server"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { refresh } from "next/cache"

import { getCustomer, type CustomerSession } from "@/lib/customer-dal"
import { ownBookings } from "@/lib/customer-bookings"
import { db } from "@/lib/db"
import {
  bookings,
  clientNotificationSettings,
  inAppNotifications,
  user,
} from "@/lib/db/schema"
import { isClientReminderChannel } from "@/lib/client-reminder-channels"
import { isPhoneAccountEmail } from "@/lib/phone-sign-in"
import {
  CLIENT_IN_APP_KINDS,
  type ClientInAppKind,
} from "@/types/in-app-notifications"
import type {
  InAppActionResult,
  InAppChoiceResult,
} from "../types/notifications"

// The client's bell (docs/plans/client-account.md, D10): reading their
// notifications and choosing the kinds they get. Each change refreshes the
// page, so the count there updates at once, as in the owner's bell.

// The account's own: client notifications of the bookings it owns.
function mine(customer: CustomerSession) {
  return and(
    eq(inAppNotifications.audience, "client"),
    inArray(
      inAppNotifications.bookingId,
      db.select({ id: bookings.id }).from(bookings).where(ownBookings(customer))
    )
  )
}

export async function markClientNotificationRead(
  id: string
): Promise<InAppActionResult> {
  const customer = await getCustomer()
  if (!customer || typeof id !== "string")
    return { ok: false, error: "not_found" }
  const where = and(eq(inAppNotifications.id, id), mine(customer))
  const [row] = await db
    .select({ readAt: inAppNotifications.readAt })
    .from(inAppNotifications)
    .where(where)
  if (!row) return { ok: false, error: "not_found" }
  if (!row.readAt) {
    await db
      .update(inAppNotifications)
      .set({ readAt: new Date().toISOString() })
      .where(where)
    refresh()
  }
  return { ok: true }
}

export async function markAllClientNotificationsRead(): Promise<InAppActionResult> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, error: "not_found" }
  await db
    .update(inAppNotifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(mine(customer), isNull(inAppNotifications.readAt)))
  refresh()
  return { ok: true }
}

// The client turns one kind on or off. One statement each way, so two quick
// switches never undo each other.
export async function setClientNotificationChoice(
  kind: ClientInAppKind,
  on: boolean
): Promise<InAppChoiceResult> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, error: "not_found" }
  if (typeof on !== "boolean" || !CLIENT_IN_APP_KINDS.includes(kind)) {
    return { ok: false, error: "invalid" }
  }
  const list = clientNotificationSettings.turnedOff
  if (on) {
    await db
      .update(clientNotificationSettings)
      .set({
        turnedOff: sql`(select json_group_array(value) from json_each(${list}) where value <> ${kind})`,
      })
      .where(eq(clientNotificationSettings.userId, customer.userId))
  } else {
    await db
      .insert(clientNotificationSettings)
      .values({ userId: customer.userId, turnedOff: [kind] })
      .onConflictDoUpdate({
        target: clientNotificationSettings.userId,
        set: {
          turnedOff: sql`case when exists (select 1 from json_each(${list}) where value = ${kind}) then ${list} else json_insert(${list}, '$[#]', ${kind}) end`,
        },
      })
  }
  refresh()
  return { ok: true }
}

// How the client's visit reminders reach them (D16). Email only for an
// account that has one.
export async function setClientReminderChannel(
  channel: string
): Promise<InAppChoiceResult> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, error: "not_found" }
  if (!isClientReminderChannel(channel)) return { ok: false, error: "invalid" }
  if (channel === "email") {
    const [account] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, customer.userId))
      .limit(1)
    if (!account || isPhoneAccountEmail(account.email)) {
      return { ok: false, error: "invalid" }
    }
  }
  await db
    .insert(clientNotificationSettings)
    .values({ userId: customer.userId, turnedOff: [], reminderChannel: channel })
    .onConflictDoUpdate({
      target: clientNotificationSettings.userId,
      set: { reminderChannel: channel },
    })
  refresh()
  return { ok: true }
}
