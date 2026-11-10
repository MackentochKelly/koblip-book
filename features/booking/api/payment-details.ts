"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businesses, paymentMethods } from "@/lib/db/schema"

// Where to send the money for one way to pay, asked for when a customer
// picks it on the pay step. Only a business that asks for payment proof
// answers: its customers pay before they confirm. The booking page itself
// never carries these (lib/payment-rules.ts, PaymentOptions). Null when
// there is nothing to show.
export async function getPaymentDetails(
  slug: string,
  methodId: string
): Promise<string | null> {
  if (typeof slug !== "string" || typeof methodId !== "string") return null
  try {
    const [row] = await db
      .select({ details: paymentMethods.details })
      .from(paymentMethods)
      .innerJoin(businesses, eq(businesses.id, paymentMethods.businessId))
      .where(
        and(
          eq(businesses.slug, slug),
          eq(paymentMethods.id, methodId),
          eq(businesses.paymentProof, true)
        )
      )
      .limit(1)
    return row?.details ?? null
  } catch {
    console.error("getPaymentDetails failed")
    return null
  }
}
