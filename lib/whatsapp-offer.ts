import "server-only"
import { and, eq, isNotNull } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  businesses,
  chatConnections,
  koblipChatConnection,
  notificationSettings,
} from "@/lib/db/schema"

// A Chat connection that can send: working, with a WhatsApp number, and
// allowed to use templates.
function canSend(row: {
  scopes: string
  needsReconnect: boolean
  phoneNumberId: string | null
}) {
  return (
    !row.needsReconnect &&
    !!row.phoneNumberId &&
    row.scopes.split(" ").includes("templates")
  )
}

// Whether a business sends customers WhatsApp booking messages: from its own
// number, or from Koblip's (K3: for a business with an owner, never a demo),
// and not every customer message turned off on its WhatsApp page. The
// booking forms ask for consent only then.
export async function offersWhatsapp(businessId: string): Promise<boolean> {
  const [[business], [own], [koblip]] = await Promise.all([
    db
      .select({
        ownerId: businesses.ownerId,
        isDemo: businesses.isDemo,
        turnedOff: notificationSettings.turnedOff,
      })
      .from(businesses)
      .leftJoin(
        notificationSettings,
        eq(notificationSettings.businessId, businesses.id)
      )
      .where(eq(businesses.id, businessId))
      .limit(1),
    db
      .select()
      .from(chatConnections)
      .where(
        and(
          eq(chatConnections.businessId, businessId),
          isNotNull(chatConnections.phoneNumberId)
        )
      )
      .limit(1),
    db.select().from(koblipChatConnection).limit(1),
  ])
  if (!business) return false
  const koblipServes =
    !!koblip && canSend(koblip) && !!business.ownerId && !business.isDemo
  if (!(own && canSend(own)) && !koblipServes) return false
  const off = business.turnedOff ?? []
  return (["confirmed", "reminder", "changed", "cancelled"] as const).some(
    (message) => !off.includes(message)
  )
}
