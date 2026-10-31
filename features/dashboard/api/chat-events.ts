import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { and, desc, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  bookings,
  chatConnections,
  chatReplies,
  koblipChatConnection,
  notificationSends,
} from "@/lib/db/schema"
import { notify } from "@/lib/in-app-notifications"
import {
  applyButtonReply,
  buttonAction,
  rememberMessageId,
  sentFromWorkspace,
} from "./notification-replies"

// Koblip Chat's signed app events: customer replies, sent messages and
// delivery status for each connected workspace (wapi-api docs/api/oauth.md,
// "App events"). Book keeps when each customer last wrote, for Meta's
// 24-hour window (docs/koblip-chat-integration.md, step 2), and WhatsApp's
// delivery status of the messages Book sent (step 3), and the customer's tap
// on a message's button (S3), for the business's own number and Koblip's.

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
  // WhatsApp's id of the message answered, and the tapped button (D6).
  replyToMessageId?: string | null
  button?: { payload?: unknown; title?: unknown } | null
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

type StatusEvent = {
  type: "status"
  workspaceId: string
  recordId: string
  status: string
  // WhatsApp's id of the message.
  messageId?: string | null
}

function status(event: unknown): StatusEvent | null {
  if (!event || typeof event !== "object") return null
  const value = event as Record<string, unknown>
  if (value.type !== "status") return null
  for (const key of ["workspaceId", "recordId", "status"]) {
    if (typeof value[key] !== "string" || !value[key]) return null
  }
  return value as StatusEvent
}

// WhatsApp's statuses in the order they happen; failed is final.
const DELIVERY_ORDER = ["sent", "delivered", "read", "failed"]

// A message Book sent moves to its newer delivery status, never back, and
// keeps WhatsApp's id of it for the customer's tap.
async function applyStatus(event: StatusEvent) {
  const rank = DELIVERY_ORDER.indexOf(event.status)
  if (rank < 0) return
  const [send] = await db
    .select({ id: notificationSends.id, delivery: notificationSends.delivery })
    .from(notificationSends)
    .where(
      and(
        eq(notificationSends.chatRecordId, event.recordId),
        sentFromWorkspace(event.workspaceId)
      )
    )
    .limit(1)
  if (!send) return
  if (typeof event.messageId === "string" && event.messageId) {
    await rememberMessageId(send.id, event.messageId)
  }
  if (DELIVERY_ORDER.indexOf(send.delivery ?? "") >= rank) return
  await db
    .update(notificationSends)
    .set({ delivery: event.status })
    .where(eq(notificationSends.id, send.id))
}

// Applies one verified event: customer replies and the delivery status of
// Book's messages; the rest are acknowledged. Delivery is at least once and
// may arrive out of order: the reply time and the delivery status only ever
// move forward, so a repeated or late event changes nothing, which is the
// deduplication Chat asks receivers for.
export async function applyChatEvent(event: unknown) {
  const delivery = status(event)
  if (delivery) return applyStatus(delivery)
  const reply = inbound(event)
  if (!reply) return
  const at = new Date(reply.occurredAt)
  const customerPhone = reply.fromPhone.replace(/\D/g, "")
  if (Number.isNaN(at.getTime()) || !customerPhone) return

  // Only for a workspace connected here: a business's or Koblip's own.
  const [[business], [koblip]] = await Promise.all([
    db
      .select({ businessId: chatConnections.businessId })
      .from(chatConnections)
      .where(
        and(
          eq(chatConnections.workspaceId, reply.workspaceId),
          eq(chatConnections.needsReconnect, false)
        )
      )
      .limit(1),
    db
      .select({ id: koblipChatConnection.id })
      .from(koblipChatConnection)
      .where(
        and(
          eq(koblipChatConnection.workspaceId, reply.workspaceId),
          eq(koblipChatConnection.needsReconnect, false)
        )
      )
      .limit(1),
  ])
  if (!business && !koblip) return

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

  const action = buttonAction(reply.button?.payload)
  if (action && typeof reply.replyToMessageId === "string" && reply.replyToMessageId) {
    await applyButtonReply({
      workspaceId: reply.workspaceId,
      replyToMessageId: reply.replyToMessageId,
      action,
      at: lastReplyAt,
    })
  } else if (!action) {
    await notifyCustomerWrote(reply.workspaceId, reply.senderId, customerPhone, !!koblip)
  }
}

// A customer wrote (not a button tap): the owner's bell hears it, one
// notification per customer that comes back unread when they write again.
// On a business's own number that business; on Koblip's, which serves many,
// the business whose message last reached this customer from it.
async function notifyCustomerWrote(
  workspaceId: string,
  phoneNumberId: string,
  customerPhone: string,
  koblip: boolean
) {
  const own = await db
    .select({ businessId: chatConnections.businessId })
    .from(chatConnections)
    .where(
      and(
        eq(chatConnections.workspaceId, workspaceId),
        eq(chatConnections.phoneNumberId, phoneNumberId),
        eq(chatConnections.needsReconnect, false)
      )
    )
  let businessIds = own.map(({ businessId }) => businessId)
  if (!businessIds.length && koblip) {
    const [last] = await db
      .select({ businessId: notificationSends.businessId })
      .from(notificationSends)
      .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
      .where(
        and(
          eq(notificationSends.sender, "koblip"),
          eq(notificationSends.state, "sent"),
          eq(bookings.customerKey, `p:${customerPhone}`)
        )
      )
      .orderBy(desc(notificationSends.sentAt))
      .limit(1)
    businessIds = last ? [last.businessId] : []
  }
  for (const businessId of businessIds) {
    const [booking] = await db
      .select({ customerName: bookings.customerName })
      .from(bookings)
      .where(and(eq(bookings.businessId, businessId), eq(bookings.customerKey, `p:${customerPhone}`)))
      .orderBy(desc(bookings.createdAt))
      .limit(1)
    await notify(
      businessId,
      "customerReplied",
      { customerName: booking?.customerName, customerPhone },
      { dedupeKey: `replied:${customerPhone}`, renew: true }
    )
  }
}
