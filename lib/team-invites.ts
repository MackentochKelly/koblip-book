import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businesses, teamInvites, teamMembers } from "@/lib/db/schema"
import { TEAM_RULES } from "@/lib/team-rules"

// A team member's link to join their business with their own account
// (docs/plans/team-accounts.md). Like a sign-in link and the Google Calendar
// links (lib/google-calendar-invites): a long random token, only its hash
// kept, one use, a few days, and a new link for the same person ends the
// old one.

function hashOf(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

// A new link for a team member of the business, ending their older ones.
export async function createTeamInvite(input: {
  businessId: string
  teamMemberId: string
  createdBy: string
}) {
  const site = process.env.BETTER_AUTH_URL
  if (!site) throw new Error("Team invites: BETTER_AUTH_URL is not set. See .env.example.")
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + TEAM_RULES.inviteDays * 86_400_000).toISOString()
  await saveAll([
    db
      .delete(teamInvites)
      .where(and(eq(teamInvites.teamMemberId, input.teamMemberId), isNull(teamInvites.usedAt))),
    db.insert(teamInvites).values({ ...input, tokenHash: hashOf(token), expiresAt }),
  ])
  return { url: new URL(`/join/${token}`, site).toString(), expiresAt }
}

export type TeamInvite = {
  id: string
  businessId: string
  teamMemberId: string
  businessName: string
  memberName: string
  // Someone already joined as this team member (this link or another).
  joined: boolean
  // Whether the link can still be used.
  state: "ready" | "used" | "expired"
}

// The link's invite, or null when there is no such link.
export async function readTeamInvite(token: string): Promise<TeamInvite | null> {
  if (!token) return null
  const [row] = await db
    .select({
      id: teamInvites.id,
      businessId: teamInvites.businessId,
      teamMemberId: teamInvites.teamMemberId,
      expiresAt: teamInvites.expiresAt,
      usedAt: teamInvites.usedAt,
      businessName: businesses.name,
      memberName: teamMembers.name,
      memberUserId: teamMembers.userId,
    })
    .from(teamInvites)
    .innerJoin(businesses, eq(businesses.id, teamInvites.businessId))
    .innerJoin(teamMembers, eq(teamMembers.id, teamInvites.teamMemberId))
    .where(eq(teamInvites.tokenHash, hashOf(token)))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    businessId: row.businessId,
    teamMemberId: row.teamMemberId,
    businessName: row.businessName,
    memberName: row.memberName,
    joined: row.memberUserId !== null,
    state: row.usedAt ? "used" : Date.parse(row.expiresAt) <= Date.now() ? "expired" : "ready",
  }
}

export type JoinResult =
  | { ok: true; teamMemberId: string }
  | { ok: false; reason: "expired" | "taken" | "already-member" }

// Links the account to the invite's team member and uses the link up, in
// one go. Fails when the link is used or old, when someone else already
// joined as that person, or when the account already has a seat in that
// business.
export async function joinWithTeamInvite(token: string, userId: string): Promise<JoinResult> {
  const invite = await readTeamInvite(token)
  if (!invite || invite.state !== "ready") return { ok: false, reason: "expired" }
  if (invite.joined) return { ok: false, reason: "taken" }
  const [seat] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.businessId, invite.businessId), eq(teamMembers.userId, userId)))
    .limit(1)
  if (seat) return { ok: false, reason: "already-member" }
  const now = new Date().toISOString()
  await saveAll([
    db
      .update(teamInvites)
      .set({ usedAt: now })
      .where(
        and(
          eq(teamInvites.id, invite.id),
          isNull(teamInvites.usedAt),
          gt(teamInvites.expiresAt, now)
        )
      ),
    db
      .update(teamMembers)
      .set({ userId })
      .where(and(eq(teamMembers.id, invite.teamMemberId), isNull(teamMembers.userId))),
  ])
  // Two taps at once: only one account ends up on the seat.
  const [after] = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.id, invite.teamMemberId))
    .limit(1)
  return after?.userId === userId
    ? { ok: true, teamMemberId: invite.teamMemberId }
    : { ok: false, reason: "taken" }
}
