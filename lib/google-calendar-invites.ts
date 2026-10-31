import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businesses, googleCalendarInvites, teamMembers } from "@/lib/db/schema"
import { GOOGLE_CALENDAR_RULES } from "@/lib/google-calendar-rules"

// A team member's link to connect their own Google Calendar, without an
// account (G5 in docs/plans/google-calendar.md). Like a sign-in link: a long
// random token, only its hash kept, one use, a few days, and a new link for
// the same person ends the old one.

function hashOf(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

// A new link for a team member of the business, ending their older ones.
export async function createGoogleInvite(input: {
  businessId: string
  teamMemberId: string
  createdBy: string
}) {
  const site = process.env.BETTER_AUTH_URL
  if (!site) throw new Error("Google Calendar: BETTER_AUTH_URL is not set. See .env.example.")
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + GOOGLE_CALENDAR_RULES.inviteDays * 86_400_000).toISOString()
  await saveAll([
    db
      .delete(googleCalendarInvites)
      .where(
        and(
          eq(googleCalendarInvites.teamMemberId, input.teamMemberId),
          isNull(googleCalendarInvites.usedAt)
        )
      ),
    db.insert(googleCalendarInvites).values({ ...input, tokenHash: hashOf(token), expiresAt }),
  ])
  return { url: new URL(`/team-calendar/${token}`, site).toString(), expiresAt }
}

export type GoogleInvite = {
  id: string
  businessId: string
  teamMemberId: string
  businessName: string
  memberName: string
  // Whether the link can still be used.
  state: "ready" | "used" | "expired"
}

// The link's invite, or null when there is no such link.
export async function readGoogleInvite(token: string): Promise<GoogleInvite | null> {
  if (!token) return null
  const [row] = await db
    .select({
      id: googleCalendarInvites.id,
      businessId: googleCalendarInvites.businessId,
      teamMemberId: googleCalendarInvites.teamMemberId,
      expiresAt: googleCalendarInvites.expiresAt,
      usedAt: googleCalendarInvites.usedAt,
      businessName: businesses.name,
      memberName: teamMembers.name,
    })
    .from(googleCalendarInvites)
    .innerJoin(businesses, eq(businesses.id, googleCalendarInvites.businessId))
    .innerJoin(teamMembers, eq(teamMembers.id, googleCalendarInvites.teamMemberId))
    .where(eq(googleCalendarInvites.tokenHash, hashOf(token)))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    businessId: row.businessId,
    teamMemberId: row.teamMemberId,
    businessName: row.businessName,
    memberName: row.memberName,
    state: row.usedAt ? "used" : Date.parse(row.expiresAt) <= Date.now() ? "expired" : "ready",
  }
}

// Whether an invite can still be used (not used, not run out, not replaced).
export async function googleInviteReady(inviteId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: googleCalendarInvites.id })
    .from(googleCalendarInvites)
    .where(
      and(
        eq(googleCalendarInvites.id, inviteId),
        isNull(googleCalendarInvites.usedAt),
        gt(googleCalendarInvites.expiresAt, new Date().toISOString())
      )
    )
    .limit(1)
  return !!row
}

// Uses up an invite once the person connected.
export async function markGoogleInviteUsed(inviteId: string) {
  await db
    .update(googleCalendarInvites)
    .set({ usedAt: new Date().toISOString() })
    .where(and(eq(googleCalendarInvites.id, inviteId), isNull(googleCalendarInvites.usedAt)))
}
