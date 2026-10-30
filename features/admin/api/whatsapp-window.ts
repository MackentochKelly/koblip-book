import "server-only"

import { desc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  businesses,
  chatConnections,
  chatReplies,
  koblipChatConnection,
} from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"

// Which number a customer wrote to: Koblip's own, one or more businesses'
// own (businesses may share a Chat workspace), or one no longer connected.
export type WindowNumber =
  | { kind: "koblip" }
  | { kind: "own"; businesses: string[] }
  | { kind: "unknown" }

export interface WindowEntry {
  workspaceId: string
  phoneNumberId: string
  // Digits only, as WhatsApp sends it.
  customerPhone: string
  lastReplyAt: string
  number: WindowNumber
  // Normal messages may go to this customer from this number now.
  open: boolean
}

export interface WhatsappWindow {
  // When it was read, for "… ago".
  now: number
  entries: WindowEntry[]
}

const key = (workspaceId: string, phoneNumberId: string) =>
  `${workspaceId}\n${phoneNumberId}`

// WhatsApp → 24-hour window (A6): who last wrote to which number and when,
// newest first (chat_replies, kept from Chat's events). Open while inside
// the rule `freeTextMinutes`, the same one the sender follows.
export async function getWhatsappWindow(): Promise<WhatsappWindow> {
  await requireAdmin()
  const now = Date.now()
  const [rows, owned, [koblip], rules] = await Promise.all([
    db
      .select()
      .from(chatReplies)
      .orderBy(desc(chatReplies.lastReplyAt))
      .limit(WHATSAPP_ADMIN_RULES.listRows),
    db
      .select({
        workspaceId: chatConnections.workspaceId,
        phoneNumberId: chatConnections.phoneNumberId,
        name: businesses.name,
      })
      .from(chatConnections)
      .innerJoin(businesses, eq(businesses.id, chatConnections.businessId)),
    db
      .select({
        workspaceId: koblipChatConnection.workspaceId,
        phoneNumberId: koblipChatConnection.phoneNumberId,
      })
      .from(koblipChatConnection)
      .limit(1),
    notificationRules(),
  ])
  const names = new Map<string, string[]>()
  for (const row of owned) {
    if (!row.phoneNumberId) continue
    const at = key(row.workspaceId, row.phoneNumberId)
    names.set(at, [...(names.get(at) ?? []), row.name])
  }
  const openSince = now - rules.freeTextMinutes * 60_000
  return {
    now,
    entries: rows.map((row) => {
      const own = names.get(key(row.workspaceId, row.phoneNumberId))
      const number: WindowNumber =
        koblip &&
        koblip.workspaceId === row.workspaceId &&
        koblip.phoneNumberId === row.phoneNumberId
          ? { kind: "koblip" }
          : own
            ? { kind: "own", businesses: own.sort() }
            : { kind: "unknown" }
      return {
        workspaceId: row.workspaceId,
        phoneNumberId: row.phoneNumberId,
        customerPhone: row.customerPhone,
        lastReplyAt: row.lastReplyAt,
        number,
        open: Date.parse(row.lastReplyAt) > openSince,
      }
    }),
  }
}
