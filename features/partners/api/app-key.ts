import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { partnerApps } from "@/lib/db/schema"
import { hashSecret } from "@/lib/partner-keys"

export type PartnerApp = {
  id: string
  name: string
  dailyInvites: number
}

// The app a partner API call comes from (docs/plans/sales-connection.md,
// SC2): its key, sent as `Authorization: Bearer <key>`, matched by hash.
// A missing, unknown or revoked key gives null.
export async function partnerAppFromRequest(
  request: Request
): Promise<PartnerApp | null> {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer (kbk_[A-Za-z0-9_-]{43})$/.exec(header)
  if (!match) return null
  const [app] = await db
    .select({
      id: partnerApps.id,
      name: partnerApps.name,
      dailyInvites: partnerApps.dailyInvites,
    })
    .from(partnerApps)
    .where(
      and(
        eq(partnerApps.keyHash, hashSecret(match[1])),
        isNull(partnerApps.revokedAt)
      )
    )
    .limit(1)
  return app ?? null
}
