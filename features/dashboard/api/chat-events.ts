import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatConnections, chatReplies } from "@/lib/db/schema"

// Koblip Chat's signed app events: customer replies, sent messages and
// delivery status for each connected workspace (wapi-api docs/api/oauth.md,
// "App events"). Book keeps when each customer last wrote, for Meta's
// 24-hour window (docs/koblip-chat-integration.md, step 2).

// Chat's freshness window for the signed timestamp.
const MAX_SKEW_SECONDS = 300

function secret() {
  const value = process.env.CHAT_EVENTS_SECRET
  if (!value) throw new Error("Koblip Chat events: CHAT_EVENTS_SECRET is not set. See .env.example.")
  return value
}

// HMAC-SHA256 of `timestamp + "." + raw body` with the app's event secret,
// as Chat signs it; checked before the body is read as JSON.
export function verifyChatEvent(
  rawBody: Buffer,
  signature: string | null,
  timestamp: string | null,
  now = Date.now()
) {
  if (!timestamp || !/^\d+$/.test(timestamp)) return false
  if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac("sha256", secret())
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest()
  const supplied = Buffer.from(signature.slice("sha256=".length), "hex")
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

type InboundEvent = {
  type: "inbound"
  workspaceId: string
  senderId: string
  fromPhone: string
  occurredAt: string
}

function inbound(event: unknown): InboundEvent | null {
  if (!event || typeof event !== "object") return null
  const value = event as Record<string, unknown>
  if (value.type !== "inbound") return null
  for (const key of ["workspaceId", "senderId", "fromPhone", "occurredAt"]) {
    if (typeof value[key] !== "string" || !value[key]) return null
  }
  return value as InboundEvent
}

// Applies one verified event. Only customer replies are kept; the rest are
// acknowledged. Delivery is at least once and may arrive out of order: the
// reply time only ever moves forward, so a repeated or late event changes
// nothing, which is the deduplication Chat asks receivers for.
export async function applyChatEvent(event: unknown) {
  const reply = inbound(event)
  if (!reply) return
  const at = new Date(reply.occurredAt)
  const customerPhone = reply.fromPhone.replace(/\D/g, "")
  if (Number.isNaN(at.getTime()) || !customerPhone) return

  // Only for a workspace a business here is connected to.
  const [connected] = await db
    .select({ businessId: chatConnections.businessId })
    .from(chatConnections)
    .where(
      and(
        eq(chatConnections.workspaceId, reply.workspaceId),
        eq(chatConnections.needsReconnect, false)
      )
    )
    .limit(1)
  if (!connected) return

  const lastReplyAt = at.toISOString()
  await db
    .insert(chatReplies)
    .values({
      workspaceId: reply.workspaceId,
      phoneNumberId: reply.senderId,
      customerPhone,
      lastReplyAt,
    })
    .onConflictDoUpdate({
      target: [chatReplies.workspaceId, chatReplies.phoneNumberId, chatReplies.customerPhone],
      set: { lastReplyAt: sql`max(${chatReplies.lastReplyAt}, excluded.last_reply_at)` },
    })
}
