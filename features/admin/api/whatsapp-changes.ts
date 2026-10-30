import "server-only"

import { desc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, platformSettingChanges, user } from "@/lib/db/schema"

// The change log shows the latest this many.
const MAX_ROWS = 200

export interface WhatsappChange {
  id: number
  key: string
  before: unknown
  after: unknown
  // Null for a change for everyone.
  businessName: string | null
  // Null once the admin's account is gone.
  changedBy: string | null
  changedAt: string
}

// WhatsApp → Change log (A7): every admin change, newest first, with the
// business it was for and who made it.
export async function getWhatsappChanges(): Promise<WhatsappChange[]> {
  await requireAdmin()
  return db
    .select({
      id: platformSettingChanges.id,
      key: platformSettingChanges.key,
      before: platformSettingChanges.before,
      after: platformSettingChanges.after,
      businessName: businesses.name,
      changedBy: user.name,
      changedAt: platformSettingChanges.changedAt,
    })
    .from(platformSettingChanges)
    .leftJoin(businesses, eq(businesses.id, platformSettingChanges.businessId))
    .leftJoin(user, eq(user.id, platformSettingChanges.changedBy))
    .orderBy(desc(platformSettingChanges.id))
    .limit(MAX_ROWS)
}
