import "server-only"

import { createHmac } from "node:crypto"
import { and, eq, gt, isNotNull, isNull, lte, or } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  businesses,
  partnerApps,
  partnerEvents,
  partnerInvites,
} from "@/lib/db/schema"
import { PARTNER_RULES, type PartnerEventType } from "@/lib/partner-rules"
import { runInTurn } from "@/lib/run-in-turn"

// What Book tells partner apps (docs/plans/sales-connection.md, SC7, SC11):
// each event is kept first, then sent signed to the app's webhook, and a
// failure is tried again by the server's timer. Shared, so the claim
// (dashboard) and a started plan (billing) can both add one.

export type PartnerEventData = {
  inviteId: string
  ref: string | null
  slug?: string
  plan?: string
}

const minutes = (n: number) => n * 60_000

async function queue(
  appId: string,
  inviteId: string,
  type: PartnerEventType,
  data: PartnerEventData,
  now: number
) {
  const id = crypto.randomUUID()
  const at = new Date(now).toISOString()
  await db.insert(partnerEvents).values({
    id,
    appId,
    inviteId,
    type,
    body: JSON.stringify({ id, type, createdAt: at, data }),
    nextAttemptAt: at,
    createdAt: at,
    updatedAt: at,
  })
}

// Sends what is due now, without waiting for the timer. Never throws.
function sendSoon() {
  void sendDuePartnerEvents().catch((error) => console.error(error))
}

// The invite's link was used: it now leads to the business at `slug`
// (SC4). The first time also tells the app.
export async function noteInviteOpened(
  inviteId: string,
  slug: string,
  now: number = Date.now()
): Promise<void> {
  const at = new Date(now).toISOString()
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1)
  if (!business) return
  const [first] = await db
    .update(partnerInvites)
    .set({ businessId: business.id, openedAt: at })
    .where(and(eq(partnerInvites.id, inviteId), isNull(partnerInvites.openedAt)))
    .returning({ appId: partnerInvites.appId, ref: partnerInvites.ref })
  if (!first) {
    // Opened before: the import may have been made again.
    await db
      .update(partnerInvites)
      .set({ businessId: business.id })
      .where(eq(partnerInvites.id, inviteId))
    return
  }
  await queue(first.appId, inviteId, "invite.opened", { inviteId, ref: first.ref, slug }, now)
  sendSoon()
}

// A business got its owner: every open invite for it, by link or by its
// Google place, is claimed, and its app told (SC7). An invite of a revoked
// app is left as it is.
export async function noteBusinessClaimed(
  businessId: string,
  now: number = Date.now()
): Promise<void> {
  const at = new Date(now).toISOString()
  const [business] = await db
    .select({ slug: businesses.slug, placeId: businesses.googlePlaceId })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business) return
  const open = await db
    .select({ id: partnerInvites.id, appId: partnerInvites.appId, ref: partnerInvites.ref })
    .from(partnerInvites)
    .innerJoin(partnerApps, eq(partnerApps.id, partnerInvites.appId))
    .where(
      and(
        isNull(partnerInvites.claimedAt),
        isNull(partnerApps.revokedAt),
        gt(partnerInvites.endsAt, at),
        business.placeId
          ? or(
              eq(partnerInvites.businessId, businessId),
              eq(partnerInvites.placeId, business.placeId)
            )
          : eq(partnerInvites.businessId, businessId)
      )
    )
  for (const invite of open) {
    const [claimed] = await db
      .update(partnerInvites)
      .set({ businessId, claimedAt: at })
      .where(and(eq(partnerInvites.id, invite.id), isNull(partnerInvites.claimedAt)))
      .returning({ id: partnerInvites.id })
    if (claimed) {
      await queue(
        invite.appId,
        invite.id,
        "invite.claimed",
        { inviteId: invite.id, ref: invite.ref, slug: business.slug },
        now
      )
    }
  }
  if (open.length > 0) sendSoon()
}

// A business that came through an invite started a paid plan (SC7).
export async function notePlanStarted(
  businessId: string,
  plan: string,
  now: number = Date.now()
): Promise<void> {
  const claimed = await db
    .select({
      id: partnerInvites.id,
      appId: partnerInvites.appId,
      ref: partnerInvites.ref,
      slug: businesses.slug,
    })
    .from(partnerInvites)
    .innerJoin(partnerApps, eq(partnerApps.id, partnerInvites.appId))
    .innerJoin(businesses, eq(businesses.id, partnerInvites.businessId))
    .where(
      and(
        eq(partnerInvites.businessId, businessId),
        isNotNull(partnerInvites.claimedAt),
        isNull(partnerApps.revokedAt)
      )
    )
  for (const invite of claimed) {
    await queue(
      invite.appId,
      invite.id,
      "plan.started",
      { inviteId: invite.id, ref: invite.ref, slug: invite.slug, plan },
      now
    )
  }
  if (claimed.length > 0) sendSoon()
}

// The signature an app checks: HMAC-SHA256 of `timestamp + "." + body`
// with its event secret, like Koblip Chat's events to Book.
export function signPartnerEvent(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`
}

// Every event due now, one at a time (the timer and a quick send never
// overlap): sent, tried again later, or given up after
// PARTNER_RULES.maxAttempts. An app without a webhook, or revoked, gets
// nothing; the admin sees why.
export function sendDuePartnerEvents(now: number = Date.now()): Promise<void> {
  return runInTurn("partner-events", () => sendDue(now))
}

async function sendDue(now: number) {
  const at = new Date(now).toISOString()
  const due = await db
    .select({
      id: partnerEvents.id,
      body: partnerEvents.body,
      attempts: partnerEvents.attempts,
      webhookUrl: partnerApps.webhookUrl,
      secret: partnerApps.eventSecret,
      revokedAt: partnerApps.revokedAt,
    })
    .from(partnerEvents)
    .innerJoin(partnerApps, eq(partnerApps.id, partnerEvents.appId))
    .where(and(eq(partnerEvents.state, "pending"), lte(partnerEvents.nextAttemptAt, at)))
    .orderBy(partnerEvents.createdAt)
    .limit(PARTNER_RULES.listed)
  for (const event of due) {
    if (event.revokedAt || !event.webhookUrl) {
      await db
        .update(partnerEvents)
        .set({ state: "failed", lastError: event.revokedAt ? "App revoked" : "No webhook" })
        .where(eq(partnerEvents.id, event.id))
      continue
    }
    const attempts = event.attempts + 1
    const error = await post(event.webhookUrl, event.secret, event.body)
    if (error === null) {
      await db
        .update(partnerEvents)
        .set({ state: "sent", attempts, sentAt: new Date().toISOString(), lastError: null })
        .where(eq(partnerEvents.id, event.id))
    } else {
      await db
        .update(partnerEvents)
        .set({
          state: attempts >= PARTNER_RULES.maxAttempts ? "failed" : "pending",
          attempts,
          lastError: error,
          nextAttemptAt: new Date(now + minutes(PARTNER_RULES.retryMinutes)).toISOString(),
        })
        .where(eq(partnerEvents.id, event.id))
    }
  }
}

// null when the app answered 2xx, else a short reason.
async function post(url: string, secret: string, body: string): Promise<string | null> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  try {
    const answer = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-koblip-timestamp": timestamp,
        "x-koblip-signature": signPartnerEvent(secret, timestamp, body),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(PARTNER_RULES.sendTimeoutMs),
    })
    return answer.ok ? null : `HTTP ${answer.status}`
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 200)
  }
}
