import "server-only"

import { desc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, notificationSettings } from "@/lib/db/schema"

// Every list stops here; the newest come first.
const MAX_ROWS = 200

export interface WhatsappBusinessRow {
  id: string
  name: string
  // How many of its messages the business turned off.
  messagesOff: number
}

// Every real business (demo copies never send), for WhatsApp → Businesses.
export async function getWhatsappBusinesses(): Promise<WhatsappBusinessRow[]> {
  await requireAdmin()
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      turnedOff: notificationSettings.turnedOff,
    })
    .from(businesses)
    .leftJoin(
      notificationSettings,
      eq(notificationSettings.businessId, businesses.id)
    )
    .where(eq(businesses.isDemo, false))
    .orderBy(desc(businesses.createdAt))
    .limit(MAX_ROWS)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    messagesOff: row.turnedOff?.length ?? 0,
  }))
}

// One real business's name, or null.
export async function getWhatsappBusiness(businessId: string) {
  await requireAdmin()
  const [row] = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  return row ?? null
}
