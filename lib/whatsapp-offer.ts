import "server-only"
import { and, eq, isNotNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatConnections, notificationSettings } from "@/lib/db/schema"

// Whether a business sends customers WhatsApp booking messages: connected to
// Koblip Chat with a WhatsApp number, and not every customer message turned
// off on its WhatsApp page. The booking forms ask for consent only then.
export async function offersWhatsapp(businessId: string): Promise<boolean> {
  const [row] = await db
    .select({
      scopes: chatConnections.scopes,
      turnedOff: notificationSettings.turnedOff,
    })
    .from(chatConnections)
    .leftJoin(notificationSettings, eq(notificationSettings.businessId, chatConnections.businessId))
    .where(
      and(
        eq(chatConnections.businessId, businessId),
        eq(chatConnections.needsReconnect, false),
        isNotNull(chatConnections.phoneNumberId)
      )
    )
    .limit(1)
  if (!row || !row.scopes.split(" ").includes("templates")) return false
  const off = row.turnedOff ?? []
  return (["confirmed", "reminder", "changed", "cancelled"] as const).some((message) => !off.includes(message))
}
