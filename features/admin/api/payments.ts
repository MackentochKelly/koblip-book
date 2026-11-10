import "server-only"

import { and, asc, count, eq } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookings, businesses, paymentMethods } from "@/lib/db/schema"
import type { PaymentMethod } from "@/lib/payment-rules"

// One business that lists ways to be paid outside the app
// (lib/payment-rules.ts), as the admin sees it: read only.
export interface AdminBusinessPayments {
  businessId: string
  businessName: string
  slug: string
  payLater: boolean
  // Payment pictures: asked for, and shown to the team.
  asksProof: boolean
  teamSeesProof: boolean
  methods: PaymentMethod[]
  // Bookings whose customer says they paid, waiting for the owner.
  toCheck: number
}

// Every real business with at least one way to pay, by name, each with its
// ways in the owner's order. Demo copies are left out, as everywhere in
// the admin.
export async function getBusinessPayments(): Promise<AdminBusinessPayments[]> {
  await requireAdmin()
  const real = eq(businesses.isDemo, false)
  const [rows, waiting] = await Promise.all([
    db
      .select({
        businessId: businesses.id,
        businessName: businesses.name,
        slug: businesses.slug,
        payLater: businesses.payLater,
        asksProof: businesses.paymentProof,
        teamSeesProof: businesses.paymentProofTeam,
        id: paymentMethods.id,
        type: paymentMethods.type,
        name: paymentMethods.name,
        details: paymentMethods.details,
      })
      .from(paymentMethods)
      .innerJoin(businesses, eq(businesses.id, paymentMethods.businessId))
      .where(real)
      .orderBy(
        asc(businesses.name),
        asc(businesses.id),
        asc(paymentMethods.position)
      ),
    db
      .select({ businessId: bookings.businessId, n: count() })
      .from(bookings)
      .innerJoin(businesses, eq(businesses.id, bookings.businessId))
      .where(and(real, eq(bookings.paymentStatus, "reported")))
      .groupBy(bookings.businessId),
  ])
  const toCheck = new Map(waiting.map((row) => [row.businessId, row.n]))
  const byBusiness = new Map<string, AdminBusinessPayments>()
  for (const { id, type, name, details, ...business } of rows) {
    const entry = byBusiness.get(business.businessId) ?? {
      ...business,
      methods: [],
      toCheck: toCheck.get(business.businessId) ?? 0,
    }
    entry.methods.push({ id, type, name, details })
    byBusiness.set(business.businessId, entry)
  }
  return [...byBusiness.values()]
}
