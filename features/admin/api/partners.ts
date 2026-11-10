import "server-only"

import { count, desc, eq } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  businesses,
  partnerApps,
  partnerEvents,
  partnerInvites,
} from "@/lib/db/schema"
import {
  PARTNER_RULES,
  type PartnerEventState,
  type PartnerEventType,
  inviteState,
  type PartnerInviteState,
} from "@/lib/partner-rules"

// The admin's Partners screen (docs/plans/sales-connection.md, SC10): each
// app, its invites and the events sent to it. Nothing hidden.

export type AdminPartnerApp = {
  id: string
  name: string
  keyHint: string
  webhookUrl: string | null
  dailyInvites: number
  revokedAt: string | null
  invites: number
  claimed: number
  createdAt: string
}

export type AdminPartnerInvite = {
  id: string
  appName: string
  ref: string | null
  placeId: string
  businessName: string | null
  businessSlug: string | null
  state: PartnerInviteState
  openedAt: string | null
  claimedAt: string | null
  endsAt: string
  createdAt: string
}

export type AdminPartnerEvent = {
  id: string
  appName: string
  type: PartnerEventType
  state: PartnerEventState
  attempts: number
  lastError: string | null
  sentAt: string | null
  createdAt: string
}

export async function getPartners(): Promise<{
  apps: AdminPartnerApp[]
  invites: AdminPartnerInvite[]
  events: AdminPartnerEvent[]
}> {
  await requireAdmin()
  const [apps, invites, events] = await Promise.all([
    db
      .select({
        id: partnerApps.id,
        name: partnerApps.name,
        keyHint: partnerApps.keyHint,
        webhookUrl: partnerApps.webhookUrl,
        dailyInvites: partnerApps.dailyInvites,
        revokedAt: partnerApps.revokedAt,
        createdAt: partnerApps.createdAt,
        invites: count(partnerInvites.id),
        claimed: count(partnerInvites.claimedAt),
      })
      .from(partnerApps)
      .leftJoin(partnerInvites, eq(partnerInvites.appId, partnerApps.id))
      .groupBy(partnerApps.id)
      .orderBy(desc(partnerApps.createdAt)),
    db
      .select({
        id: partnerInvites.id,
        appName: partnerApps.name,
        revokedAt: partnerApps.revokedAt,
        ref: partnerInvites.ref,
        placeId: partnerInvites.placeId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        openedAt: partnerInvites.openedAt,
        claimedAt: partnerInvites.claimedAt,
        endsAt: partnerInvites.endsAt,
        createdAt: partnerInvites.createdAt,
      })
      .from(partnerInvites)
      .innerJoin(partnerApps, eq(partnerApps.id, partnerInvites.appId))
      .leftJoin(businesses, eq(businesses.id, partnerInvites.businessId))
      .orderBy(desc(partnerInvites.createdAt))
      .limit(PARTNER_RULES.listed),
    db
      .select({
        id: partnerEvents.id,
        appName: partnerApps.name,
        type: partnerEvents.type,
        state: partnerEvents.state,
        attempts: partnerEvents.attempts,
        lastError: partnerEvents.lastError,
        sentAt: partnerEvents.sentAt,
        createdAt: partnerEvents.createdAt,
      })
      .from(partnerEvents)
      .innerJoin(partnerApps, eq(partnerApps.id, partnerEvents.appId))
      .orderBy(desc(partnerEvents.createdAt))
      .limit(PARTNER_RULES.listed),
  ])
  const now = Date.now()
  return {
    apps,
    invites: invites.map(({ revokedAt, ...invite }) => ({
      ...invite,
      state: inviteState(invite, revokedAt !== null, now),
    })),
    events,
  }
}
