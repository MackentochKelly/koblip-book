import "server-only"
import { and, eq, exists, isNull, lt, or, type SQL } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  bookings,
  businesses,
  chatConnections,
  koblipChatConnection,
  notificationSends,
} from "@/lib/db/schema"
import type { ButtonAction } from "../types/notifications"
import { notificationSettingsFor } from "./notifications"
import { revalidateBusiness } from "./owned-business"

// A customer's answer to a message's button (S3, D2, D16). Chat's inbound
// event names the message it answers by WhatsApp's id (D6); Book saves the
// reply on that send, acts on the booking as the owner chose, and queues
// the owner's alert and the thank-you for the sender.

const ACTIONS: readonly ButtonAction[] = ["confirm", "cantCome", "ok"]

export function buttonAction(payload: unknown): ButtonAction | null {
  return ACTIONS.find((action) => action === payload) ?? null
}

// A send went out through this Chat workspace: the business's own when it
// sends from its number, Koblip's when it sends from Koblip's.
export function sentFromWorkspace(workspaceId: string): SQL {
  return or(
    and(
      eq(notificationSends.sender, "own"),
      exists(
        db
          .select({ id: chatConnections.businessId })
          .from(chatConnections)
          .where(
            and(
              eq(chatConnections.businessId, notificationSends.businessId),
              eq(chatConnections.workspaceId, workspaceId)
            )
          )
      )
    ),
    and(
      eq(notificationSends.sender, "koblip"),
      exists(
        db
          .select({ id: koblipChatConnection.id })
          .from(koblipChatConnection)
          .where(eq(koblipChatConnection.workspaceId, workspaceId))
      )
    )
  )!
}

export type ButtonReply = {
  workspaceId: string
  // WhatsApp's id of the message that carried the button.
  replyToMessageId: string
  action: ButtonAction
  at: string
}

// Saves a tap and acts on it once. Chat delivers events at least once and
// maybe out of order: a reply only replaces an older one, so a repeated or
// late event changes nothing.
export async function applyButtonReply(reply: ButtonReply) {
  const [found] = await db
    .select({
      send: notificationSends,
      booking: bookings,
      slug: businesses.slug,
    })
    .from(notificationSends)
    .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
    .innerJoin(businesses, eq(businesses.id, notificationSends.businessId))
    .where(
      and(
        eq(notificationSends.chatMessageId, reply.replyToMessageId),
        sentFromWorkspace(reply.workspaceId)
      )
    )
    .limit(1)
  if (!found) return
  const { send, booking } = found
  if (send.repliedAt && send.repliedAt >= reply.at) return

  const writes: BatchItem<"sqlite">[] = [
    db
      .update(notificationSends)
      .set({ replyAction: reply.action, repliedAt: reply.at })
      .where(
        and(
          eq(notificationSends.id, send.id),
          or(isNull(notificationSends.repliedAt), lt(notificationSends.repliedAt, reply.at))
        )
      ),
  ]

  // Only a tap about the booking as it stands now acts on it: after a move,
  // an answer to an older message is kept but changes nothing. Two copies
  // of one event act once: the booking cancels only while confirmed, and
  // each queued message exists once per booking and move.
  const current =
    send.moves === booking.moves &&
    booking.status === "confirmed" &&
    Date.parse(booking.startAt) > Date.parse(reply.at)
  if (!current) return saveAll(writes)

  const settings = await notificationSettingsFor(booking.businessId)
  const queued: (typeof notificationSends.$inferInsert)[] = []
  const base = {
    businessId: booking.businessId,
    bookingId: booking.id,
    moves: booking.moves,
    dueAt: new Date().toISOString(),
    sender: send.sender,
  }

  if (reply.action === "cantCome") {
    const cancel = settings.cantCome === "cancel"
    if (cancel) {
      writes.push(
        db
          .update(bookings)
          .set({ status: "cancelled" })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed")))
      )
    }
    queued.push({
      ...base,
      message: cancel ? "ownerCancelled" : "ownerCantCome",
      state: settings.ownerPhone ? "pending" : "skipped",
      reason: settings.ownerPhone ? null : "noOwnerPhone",
    })
  }
  if (settings.thankYouReply) {
    queued.push({ ...base, message: "thankYou", state: "pending" })
  }
  if (queued.length) {
    writes.push(db.insert(notificationSends).values(queued).onConflictDoNothing())
  }
  await saveAll(writes)
  if (reply.action === "cantCome" && settings.cantCome === "cancel") {
    revalidateBusiness(found.slug)
  }
}

// Saves WhatsApp's id of a message Book sent, from Chat's status events, so
// a later tap can name it.
export function rememberMessageId(sendId: string, messageId: string) {
  return db
    .update(notificationSends)
    .set({ chatMessageId: messageId })
    .where(and(eq(notificationSends.id, sendId), isNull(notificationSends.chatMessageId)))
}
