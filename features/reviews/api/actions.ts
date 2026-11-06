"use server"

import { and, eq } from "drizzle-orm"

import { ownBookings } from "@/lib/customer-bookings"
import { getCustomer } from "@/lib/customer-dal"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookings, businesses, reviews } from "@/lib/db/schema"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { REVIEW_RULES, isReviewHideReason } from "@/lib/review-rules"
import type { ReviewResult } from "../types"
import { reviewable } from "./rules"

const DAY = 86_400_000

// The client rates one of their own visits once it's over (D15): 1–5 stars
// and an optional comment. Changed again only within `editDays`.
export async function saveReview(
  bookingId: string,
  stars: number,
  comment: string
): Promise<ReviewResult> {
  const customer = await getCustomer()
  if (!customer || typeof bookingId !== "string") {
    return { ok: false, error: "not_found" }
  }
  const text = typeof comment === "string" ? comment.trim() : ""
  if (
    !Number.isInteger(stars) ||
    stars < 1 ||
    stars > 5 ||
    text.length > REVIEW_RULES.maxComment
  ) {
    return { ok: false, error: "invalid" }
  }
  const now = new Date()
  const [booking] = await db
    .select({
      id: bookings.id,
      businessId: bookings.businessId,
      slug: businesses.slug,
      leftAt: reviews.createdAt,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), ownBookings(customer), reviewable(now)))
    .limit(1)
  if (!booking) return { ok: false, error: "not_found" }
  if (
    booking.leftAt &&
    now.getTime() - Date.parse(booking.leftAt) > REVIEW_RULES.editDays * DAY
  ) {
    return { ok: false, error: "too_late" }
  }
  const values = { stars, comment: text || null }
  await db
    .insert(reviews)
    .values({
      ...values,
      bookingId: booking.id,
      businessId: booking.businessId,
      userId: customer.userId,
      authorName: customer.name.trim().split(/\s+/)[0] || customer.name,
    })
    .onConflictDoUpdate({ target: reviews.bookingId, set: values })
  revalidateBusiness(booking.slug)
  return { ok: true }
}

// The owner hides a review from their page with a reason, or shows it
// again. They can never change what the client wrote.
export async function setReviewHidden(
  businessId: string,
  reviewId: string,
  reason: string | null
): Promise<ReviewResult> {
  const session = await requireOwner()
  if (reason !== null && !isReviewHideReason(reason)) {
    return { ok: false, error: "invalid" }
  }
  const [review] = await db
    .select({ id: reviews.id, slug: businesses.slug })
    .from(reviews)
    .innerJoin(businesses, eq(businesses.id, reviews.businessId))
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(reviews.businessId, businessId),
        eq(businesses.ownerId, session.userId)
      )
    )
    .limit(1)
  if (!review) return { ok: false, error: "not_found" }
  await db
    .update(reviews)
    .set(
      reason
        ? { hiddenAt: new Date().toISOString(), hiddenReason: reason }
        : { hiddenAt: null, hiddenReason: null }
    )
    .where(eq(reviews.id, review.id))
  revalidateBusiness(review.slug)
  return { ok: true }
}
