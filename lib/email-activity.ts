import "server-only"
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, emailSends } from "@/lib/db/schema"
import { BOOKING_EMAILS, isBookingEmail } from "@/lib/email-rules"
import type { EmailActivityFilter, EmailActivityRow } from "@/types/email"

// A LIKE pattern that finds `text` anywhere, with LIKE's own wildcards
// taken literally.
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

// When an email went, or goes.
const at = sql<string>`coalesce(${emailSends.sentAt}, ${emailSends.dueAt}, ${emailSends.createdAt})`

// One business's booking emails, newest first (docs/plans/email.md, EM-10):
// what is waiting, sent, or was not sent and why; narrowed by email, state
// and a search by customer name or address.
export async function emailActivity(
  businessId: string,
  filter: EmailActivityFilter,
  limit: number
): Promise<EmailActivityRow[]> {
  const search = filter.search?.trim()
  const conditions: (SQL | undefined)[] = [
    eq(emailSends.businessId, businessId),
    inArray(emailSends.kind, filter.kind ? [filter.kind] : [...BOOKING_EMAILS]),
    filter.state ? eq(emailSends.state, filter.state) : undefined,
    search
      ? or(
          sql`${bookings.customerName} like ${contains(search)} escape '\\'`,
          sql`${emailSends.email} like ${contains(search.toLowerCase())} escape '\\'`
        )
      : undefined,
  ]
  const rows = await db
    .select({
      id: emailSends.id,
      kind: emailSends.kind,
      email: emailSends.email,
      customerName: bookings.customerName,
      at,
      state: emailSends.state,
      reason: emailSends.reason,
      delivery: emailSends.delivery,
    })
    .from(emailSends)
    .leftJoin(bookings, eq(bookings.id, emailSends.bookingId))
    .where(and(...conditions))
    .orderBy(desc(at))
    .limit(limit)
  return rows.flatMap(({ kind, ...row }) => (isBookingEmail(kind) ? [{ ...row, kind }] : []))
}
