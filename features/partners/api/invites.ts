import "server-only"

import { and, count, eq, gt, isNotNull, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { businesses, partnerApps, partnerInvites } from "@/lib/db/schema"
import { hashSecret, INVITE_CODE_PATTERN, newInviteCode } from "@/lib/partner-keys"
import {
  inviteState,
  PARTNER_RULES,
  PLACE_ID_PATTERN,
  type PartnerInviteState,
} from "@/lib/partner-rules"
import type { PartnerApp } from "./app-key"

// Invite links (docs/plans/sales-connection.md, SC3–SC6): an app asks for
// one per Google place; only the place ID, the app's own reference and the
// code's hash are kept.

const site = () => {
  const url = process.env.BETTER_AUTH_URL
  if (!url) throw new Error("Partner invites: BETTER_AUTH_URL is not set. See .env.example.")
  return url
}

export const inviteUrl = (code: string) =>
  new URL(`/start/${code}`, site()).toString()

const pageUrl = (slug: string) => new URL(`/b/${slug}`, site()).toString()

export type PublicInvite = {
  id: string
  ref: string | null
  placeId: string
  state: PartnerInviteState
  openedAt: string | null
  claimedAt: string | null
  endsAt: string
  pageUrl: string | null
}

export type CreateInviteResult =
  | { ok: true; invite: PublicInvite; url: string }
  | { ok: false; error: "invalid" }
  | { ok: false; error: "daily_cap" }
  | { ok: false; error: "invite_open"; id: string }
  | { ok: false; error: "already_on_book"; pageUrl: string }

export function readInviteInput(
  body: unknown
): { placeId: string; ref: string | null } | null {
  if (!body || typeof body !== "object") return null
  const { placeId, ref } = body as Record<string, unknown>
  if (typeof placeId !== "string" || !PLACE_ID_PATTERN.test(placeId)) return null
  if (ref !== undefined && ref !== null) {
    if (typeof ref !== "string") return null
    const trimmed = ref.trim()
    if (!trimmed || trimmed.length > PARTNER_RULES.maxRef) return null
    return { placeId, ref: trimmed }
  }
  return { placeId, ref: null }
}

export async function createInvite(
  app: PartnerApp,
  input: { placeId: string; ref: string | null },
  now: number = Date.now()
): Promise<CreateInviteResult> {
  const at = new Date(now).toISOString()
  // A business already owned on Book needs no invite (SC5).
  const [owned] = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(
      and(
        eq(businesses.googlePlaceId, input.placeId),
        isNotNull(businesses.ownerId)
      )
    )
    .limit(1)
  if (owned) return { ok: false, error: "already_on_book", pageUrl: pageUrl(owned.slug) }
  // Its open invite for this place: the app keeps the link it got (SC5).
  const [open] = await db
    .select({ id: partnerInvites.id })
    .from(partnerInvites)
    .where(
      and(
        eq(partnerInvites.appId, app.id),
        eq(partnerInvites.placeId, input.placeId),
        isNull(partnerInvites.claimedAt),
        gt(partnerInvites.endsAt, at)
      )
    )
    .limit(1)
  if (open) return { ok: false, error: "invite_open", id: open.id }
  const since = new Date(now - 86_400_000).toISOString()
  const [{ made }] = await db
    .select({ made: count() })
    .from(partnerInvites)
    .where(and(eq(partnerInvites.appId, app.id), gt(partnerInvites.createdAt, since)))
  if (made >= app.dailyInvites) return { ok: false, error: "daily_cap" }

  const code = newInviteCode()
  const endsAt = new Date(now + PARTNER_RULES.inviteDays * 86_400_000).toISOString()
  const [row] = await db
    .insert(partnerInvites)
    .values({
      appId: app.id,
      codeHash: code.hash,
      placeId: input.placeId,
      ref: input.ref,
      endsAt,
      createdAt: at,
      updatedAt: at,
    })
    .returning({ id: partnerInvites.id })
  return {
    ok: true,
    url: inviteUrl(code.code),
    invite: {
      id: row.id,
      ref: input.ref,
      placeId: input.placeId,
      state: "open",
      openedAt: null,
      claimedAt: null,
      endsAt,
      pageUrl: null,
    },
  }
}

// One of the app's own invites, as the API shows it; another app's is not
// found.
export async function readInvite(
  app: PartnerApp,
  inviteId: string
): Promise<PublicInvite | null> {
  const [row] = await db
    .select({
      id: partnerInvites.id,
      ref: partnerInvites.ref,
      placeId: partnerInvites.placeId,
      openedAt: partnerInvites.openedAt,
      claimedAt: partnerInvites.claimedAt,
      endsAt: partnerInvites.endsAt,
      slug: businesses.slug,
      ownerId: businesses.ownerId,
    })
    .from(partnerInvites)
    .leftJoin(businesses, eq(businesses.id, partnerInvites.businessId))
    .where(and(eq(partnerInvites.id, inviteId), eq(partnerInvites.appId, app.id)))
    .limit(1)
  if (!row) return null
  const { slug, ownerId, ...invite } = row
  return {
    ...invite,
    state: inviteState(invite, false),
    pageUrl: slug && ownerId ? pageUrl(slug) : null,
  }
}

// The invite a link's code opens, for the start page (SC4): what to show,
// or where to go.
export type StartingInvite =
  | { state: "open"; id: string; appId: string; placeId: string; ref: string | null }
  | { state: "claimed"; slug: string | null }
  | { state: "ended" }

export async function findInviteByCode(code: string): Promise<StartingInvite> {
  if (!INVITE_CODE_PATTERN.test(code)) return { state: "ended" }
  const [row] = await db
    .select({
      id: partnerInvites.id,
      appId: partnerInvites.appId,
      placeId: partnerInvites.placeId,
      ref: partnerInvites.ref,
      claimedAt: partnerInvites.claimedAt,
      endsAt: partnerInvites.endsAt,
      revokedAt: partnerApps.revokedAt,
      slug: businesses.slug,
    })
    .from(partnerInvites)
    .innerJoin(partnerApps, eq(partnerApps.id, partnerInvites.appId))
    .leftJoin(businesses, eq(businesses.id, partnerInvites.businessId))
    .where(eq(partnerInvites.codeHash, hashSecret(code)))
    .limit(1)
  if (!row) return { state: "ended" }
  const state = inviteState(row, row.revokedAt !== null)
  if (state === "claimed") return { state, slug: row.slug }
  if (state !== "open") return { state: "ended" }
  return { state, id: row.id, appId: row.appId, placeId: row.placeId, ref: row.ref }
}
