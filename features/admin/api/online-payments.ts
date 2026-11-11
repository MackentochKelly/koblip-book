import "server-only"

import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookings, businesses, onlinePaymentEvents } from "@/lib/db/schema"
import {
  ONLINE_PAYMENT_KINDS,
  type OnlinePaymentKind,
} from "@/lib/online-payment-events"
import { onlinePayOf, type OnlinePay } from "@/lib/payment-rules"
import { type StripeState, stripeStateOf } from "@/lib/stripe-connect"

// The history stops here; the newest come first.
const MAX_ROWS = 200

export interface AdminOnlinePayments {
  // Each real business that started with Stripe, by name.
  businesses: {
    id: string
    name: string
    currency: string
    state: StripeState
    stripeAccountId: string | null
    // What its customers pay by card when they book; null when off.
    pay: OnlinePay | null
  }[]
  // Everything that happened to online payments.
  events: {
    id: string
    kind: OnlinePaymentKind | null
    businessName: string | null
    customerName: string | null
    stripeAccountId: string | null
    amountMinor: number | null
    currency: string | null
    note: string | null
    at: string
  }[]
}

// Admin > Online payments (docs/plans/online-payments.md, ON-11): each
// business's Stripe account and what it charges, and every payment event.
// Read only. Demo copies are left out, as everywhere in the admin.
export async function getAdminOnlinePayments(): Promise<AdminOnlinePayments> {
  await requireAdmin()
  const [shops, events] = await Promise.all([
    db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.isDemo, false),
          or(
            isNotNull(businesses.stripeAccountId),
            isNotNull(businesses.stripeRefusedCountry)
          )
        )
      )
      .orderBy(asc(businesses.name), asc(businesses.id)),
    db
      .select({
        id: onlinePaymentEvents.id,
        kind: onlinePaymentEvents.kind,
        businessName: businesses.name,
        customerName: bookings.customerName,
        stripeAccountId: onlinePaymentEvents.stripeAccountId,
        amountMinor: onlinePaymentEvents.amountMinor,
        currency: onlinePaymentEvents.currency,
        note: onlinePaymentEvents.note,
        at: onlinePaymentEvents.createdAt,
      })
      .from(onlinePaymentEvents)
      .leftJoin(businesses, eq(businesses.id, onlinePaymentEvents.businessId))
      .leftJoin(bookings, eq(bookings.id, onlinePaymentEvents.bookingId))
      .orderBy(desc(onlinePaymentEvents.createdAt))
      .limit(MAX_ROWS),
  ])
  return {
    businesses: shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      currency: shop.currency,
      state: stripeStateOf(shop),
      stripeAccountId: shop.stripeAccountId,
      pay: onlinePayOf(shop),
    })),
    events: events.map((event) => ({
      ...event,
      kind: ONLINE_PAYMENT_KINDS.find((kind) => kind === event.kind) ?? null,
    })),
  }
}
