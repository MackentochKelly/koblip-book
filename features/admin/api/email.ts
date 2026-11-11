import "server-only"
import { desc, eq, sql } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, emailBlocks } from "@/lib/db/schema"
import { emailActivity } from "@/lib/email-activity"
import { EMAIL_KINDS, type EmailBlockReason } from "@/lib/email-rules"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"
import type { EmailActivityFilter, EmailActivityRow } from "@/types/email"

// Email (docs/plans/email.md, EM-11): every email Book sent or will send,
// for every business and none (sign-up, password), newest first, with the
// filters and search of a business's own history.
export async function getEmailActivity(filter: EmailActivityFilter): Promise<EmailActivityRow[]> {
  await requireAdmin()
  return emailActivity({ kinds: EMAIL_KINDS }, filter, WHATSAPP_ADMIN_RULES.listRows)
}

export type EmailBlockRow = {
  id: string
  email: string
  // Null: blocked for every business (a bounce or a spam report).
  businessName: string | null
  reason: EmailBlockReason
  createdAt: string
}

// Email → Blocked: every address that gets no more email, newest first,
// searched by address.
export async function getEmailBlocks(search?: string): Promise<EmailBlockRow[]> {
  await requireAdmin()
  const text = search?.trim().toLowerCase()
  return db
    .select({
      id: emailBlocks.id,
      email: emailBlocks.email,
      businessName: businesses.name,
      reason: emailBlocks.reason,
      createdAt: emailBlocks.createdAt,
    })
    .from(emailBlocks)
    .leftJoin(businesses, eq(businesses.id, emailBlocks.businessId))
    .where(
      // LIKE's own wildcards taken literally.
      text
        ? sql`${emailBlocks.email} like ${`%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`} escape '\\'`
        : undefined
    )
    .orderBy(desc(emailBlocks.createdAt))
    .limit(WHATSAPP_ADMIN_RULES.listRows)
}

// What sending needs, set or not: only whether each server setting is set
// is shown, and the sender's address, never a key.
export async function getEmailSetup() {
  await requireAdmin()
  return {
    from: process.env.EMAIL_FROM ?? null,
    region: process.env.AWS_REGION ?? null,
    configurationSet: process.env.SES_CONFIGURATION_SET ?? null,
    keys: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  }
}

export type EmailSetup = Awaited<ReturnType<typeof getEmailSetup>>
