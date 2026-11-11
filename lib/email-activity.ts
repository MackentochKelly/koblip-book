import "server-only"
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, businesses, emailSends } from "@/lib/db/schema"
import type { EmailKind } from "@/lib/email-rules"
import type { EmailActivityFilter, EmailActivityRow } from "@/types/email"

// A LIKE pattern that finds `text` anywhere, with LIKE's own wildcards
// taken literally.
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

// When an email went, or goes.
const at = sql<string>`coalesce(${emailSends.sentAt}, ${emailSends.dueAt}, ${emailSends.createdAt})`

// Emails newest first: one business's booking emails on its Email page
// (docs/plans/email.md, EM-10), or every email in the admin (EM-11). What is
// waiting, sent, or was not sent and why; narrowed to `kinds`, by email and
// state, and by a search of customer name, address or business name.
export async function emailActivity(
  scope: { businessId?: string; kinds: readonly EmailKind[] },
  filter: EmailActivityFilter,
  limit: number
): Promise<EmailActivityRow[]> {
  const search = filter.search?.trim()
  const conditions: (SQL | undefined)[] = [
    scope.businessId ? eq(emailSends.businessId, scope.businessId) : undefined,
    inArray(emailSends.kind, filter.kind ? [filter.kind] : [...scope.kinds]),
    filter.state ? eq(emailSends.state, filter.state) : undefined,
    search
      ? or(
          sql`${bookings.customerName} like ${contains(search)} escape '\\'`,
          sql`${emailSends.email} like ${contains(search.toLowerCase())} escape '\\'`,
          sql`${businesses.name} like ${contains(search)} escape '\\'`
        )
      : undefined,
  ]
  return db
    .select({
      id: emailSends.id,
      kind: emailSends.kind,
      email: emailSends.email,
      customerName: bookings.customerName,
      businessName: businesses.name,
      timeZone: businesses.timezone,
      at,
      state: emailSends.state,
      reason: emailSends.reason,
      delivery: emailSends.delivery,
    })
    .from(emailSends)
    .leftJoin(bookings, eq(bookings.id, emailSends.bookingId))
    .leftJoin(businesses, eq(businesses.id, emailSends.businessId))
    .where(and(...conditions))
    .orderBy(desc(at))
    .limit(limit)
}
