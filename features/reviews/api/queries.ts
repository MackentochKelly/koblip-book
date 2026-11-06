import "server-only"
import { and, avg, count, desc, eq, isNull, sql } from "drizzle-orm"

import { ownBookings } from "@/lib/customer-bookings"
import type { CustomerSession } from "@/lib/customer-dal"
import { requireAdmin, requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { bookings, businesses, reviews } from "@/lib/db/schema"
import { REVIEW_RULES } from "@/lib/review-rules"
import type {
  ListedReview,
  MyReview,
  ReviewSummary,
} from "../types"
import { reviewable } from "./rules"

const DAY = 86_400_000

// The client's review of one of their own visits (D15); null when the
// booking isn't theirs.
export async function myReview(
  customer: CustomerSession,
  bookingId: string,
  now: Date = new Date()
): Promise<MyReview | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      canReview: sql<number>`${reviewable(now)}`,
      stars: reviews.stars,
      comment: reviews.comment,
      leftAt: reviews.createdAt,
    })
    .from(bookings)
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), ownBookings(customer)))
    .limit(1)
  if (!row) return null
  return {
    canReview: Boolean(row.canReview),
    review:
      row.stars === null || row.leftAt === null
        ? null
        : {
            stars: row.stars,
            comment: row.comment,
            editable:
              now.getTime() - Date.parse(row.leftAt) <=
              REVIEW_RULES.editDays * DAY,
          },
  }
}

// What the business page shows (D15): the average and count of the
// reviews it hasn't hidden, and the latest of them.
export async function reviewSummary(businessId: string): Promise<ReviewSummary> {
  const shown = and(eq(reviews.businessId, businessId), isNull(reviews.hiddenAt))
  const [[totals], latest] = await Promise.all([
    db.select({ average: avg(reviews.stars), count: count() }).from(reviews).where(shown),
    db
      .select({
        id: reviews.id,
        authorName: reviews.authorName,
        stars: reviews.stars,
        comment: reviews.comment,
        at: reviews.createdAt,
      })
      .from(reviews)
      .where(shown)
      .orderBy(desc(reviews.createdAt))
      .limit(REVIEW_RULES.latestShown),
  ])
  return {
    average:
      totals.count > 0 && totals.average !== null
        ? Math.round(Number(totals.average) * 10) / 10
        : null,
    count: totals.count,
    latest,
  }
}

function listed() {
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      stars: reviews.stars,
      comment: reviews.comment,
      at: reviews.createdAt,
      hiddenReason: reviews.hiddenReason,
      businessName: businesses.name,
      serviceName: bookings.serviceName,
    })
    .from(reviews)
    .innerJoin(businesses, eq(businesses.id, reviews.businessId))
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
}

// Every review of one of the owner's businesses, hidden ones too; null
// when the business isn't theirs.
export async function ownerReviews(businessId: string): Promise<ListedReview[] | null> {
  const session = await requireOwner()
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, session.userId)))
    .limit(1)
  if (!business) return null
  return listed()
    .where(eq(reviews.businessId, business.id))
    .orderBy(desc(reviews.createdAt))
}

// The admin's list: every review at every business, newest first.
export async function adminReviews(limit = 200): Promise<ListedReview[]> {
  await requireAdmin()
  return listed().orderBy(desc(reviews.createdAt)).limit(limit)
}
