import "server-only"
import { and, eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "./db"
import { bookings, notificationSends, notificationSettings } from "./db/schema"
import { requestGoogleSync } from "./google-calendar-sync"
import { notification } from "./in-app-notifications"
import { notificationRules } from "./platform-settings"
import { revalidateBusiness } from "./revalidate-business"

// What a customer's "I can't make it" does, the same wherever they say it:
// a WhatsApp "Can't make it" tap or My bookings. The owner chooses: the
// booking cancels, or stays and the owner is told.
export type CantComeSettings = {
  cantCome: "cancel" | "alertOnly"
  // The owner's WhatsApp for alerts; null: no alert goes.
  ownerPhone: string | null
}

export async function cantComeSettingsFor(
  businessId: string
): Promise<CantComeSettings> {
  const [[row], rules] = await Promise.all([
    db
      .select({
        cantCome: notificationSettings.cantCome,
        ownerPhone: notificationSettings.ownerPhone,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.businessId, businessId))
      .limit(1),
    notificationRules(businessId),
  ])
  return {
    cantCome: row?.cantCome ?? rules.defaultCantCome,
    ownerPhone: row?.ownerPhone ?? null,
  }
}

type Booking = Pick<
  typeof bookings.$inferSelect,
  "id" | "businessId" | "moves" | "customerName" | "serviceName" | "startAt"
>

// The writes for it, to save with the rest (saveAll): the booking cancels
// while still confirmed, the owner's WhatsApp alert is queued and the
// bell rings, each once per booking and move however often the customer
// says it. `sender` keeps a WhatsApp answer on the number it came to.
export async function customerCantComeWrites(
  booking: Booking,
  settings: CantComeSettings,
  sender?: "koblip" | "own"
): Promise<{ writes: BatchItem<"sqlite">[]; cancelled: boolean }> {
  const cancelled = settings.cantCome === "cancel"
  const writes: BatchItem<"sqlite">[] = []
  if (cancelled) {
    writes.push(
      db
        .update(bookings)
        .set({ status: "cancelled" })
        .where(
          and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed"))
        )
    )
  }
  writes.push(
    db
      .insert(notificationSends)
      .values({
        businessId: booking.businessId,
        bookingId: booking.id,
        moves: booking.moves,
        dueAt: new Date().toISOString(),
        ...(sender && { sender }),
        message: cancelled ? "ownerCancelled" : "ownerCantCome",
        state: settings.ownerPhone ? "pending" : "skipped",
        reason: settings.ownerPhone ? null : "noOwnerPhone",
      })
      .onConflictDoNothing()
  )
  const kind = cancelled ? "customerCancelled" : "customerCantCome"
  writes.push(
    ...(await notification(
      booking.businessId,
      kind,
      {
        customerName: booking.customerName,
        serviceName: booking.serviceName,
        startAt: booking.startAt,
      },
      { dedupeKey: `${kind}:${booking.id}:${booking.moves}` }
    ))
  )
  return { writes, cancelled }
}

// Once a cancel is saved: the business's page frees the time and Google
// Calendar hears of it now.
export function afterCustomerCancel(businessId: string, slug: string): void {
  revalidateBusiness(slug)
  requestGoogleSync(businessId)
}
