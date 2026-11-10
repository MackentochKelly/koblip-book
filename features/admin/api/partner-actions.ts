"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { partnerApps } from "@/lib/db/schema"
import { newApiKey, newEventSecret } from "@/lib/partner-keys"
import { PARTNER_RULES, validWebhookUrl } from "@/lib/partner-rules"

// The admin's partner apps (docs/plans/sales-connection.md, SC2, SC10):
// add one (its key and event secret are shown once), change its webhook
// and daily cap, or revoke it for good.

const PAGE = "/admin/partners"

export type PartnerAppInput = {
  name: string
  webhookUrl: string
  dailyInvites: number
}

type Invalid = { ok: false; error: "invalid" | "not_found" }

function read(input: PartnerAppInput):
  | { name: string; webhookUrl: string | null; dailyInvites: number }
  | null {
  if (!input || typeof input !== "object") return null
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const webhook =
    typeof input.webhookUrl === "string" ? input.webhookUrl.trim() : ""
  const daily = input.dailyInvites
  if (!name || name.length > PARTNER_RULES.maxName) return null
  if (webhook && !validWebhookUrl(webhook, process.env.NODE_ENV !== "production")) {
    return null
  }
  if (
    !Number.isInteger(daily) ||
    daily < 1 ||
    daily > PARTNER_RULES.maxDailyInvites
  ) {
    return null
  }
  return { name, webhookUrl: webhook || null, dailyInvites: daily }
}

export async function addPartnerApp(
  input: PartnerAppInput
): Promise<{ ok: true; key: string; eventSecret: string } | Invalid> {
  await requireAdmin()
  const values = read(input)
  if (!values) return { ok: false, error: "invalid" }
  const key = newApiKey()
  const eventSecret = newEventSecret()
  await db.insert(partnerApps).values({
    ...values,
    keyHash: key.hash,
    keyHint: key.hint,
    eventSecret,
  })
  revalidatePath(PAGE)
  return { ok: true, key: key.key, eventSecret }
}

export async function updatePartnerApp(
  appId: string,
  input: PartnerAppInput
): Promise<{ ok: true } | Invalid> {
  await requireAdmin()
  const values = read(input)
  if (!values || typeof appId !== "string") return { ok: false, error: "invalid" }
  const changed = await db
    .update(partnerApps)
    .set(values)
    .where(and(eq(partnerApps.id, appId), isNull(partnerApps.revokedAt)))
    .returning({ id: partnerApps.id })
  if (changed.length === 0) return { ok: false, error: "not_found" }
  revalidatePath(PAGE)
  return { ok: true }
}

// For good: its key stops working, its open invites end, and no more
// events are sent to it. Its history stays.
export async function revokePartnerApp(
  appId: string
): Promise<{ ok: true } | Invalid> {
  await requireAdmin()
  if (typeof appId !== "string") return { ok: false, error: "invalid" }
  const changed = await db
    .update(partnerApps)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(partnerApps.id, appId), isNull(partnerApps.revokedAt)))
    .returning({ id: partnerApps.id })
  if (changed.length === 0) return { ok: false, error: "not_found" }
  revalidatePath(PAGE)
  return { ok: true }
}
