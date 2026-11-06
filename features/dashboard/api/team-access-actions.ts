"use server"

import { and, eq, isNull } from "drizzle-orm"

import { hasFeature } from "@/lib/plan-access"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { teamInvites, teamMembers } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"
import { teamInviteEmail } from "@/lib/email-templates"
import { createTeamInvite } from "@/lib/team-invites"
import { TEAM_RULES } from "@/lib/team-rules"
import { getOwnerLanguage } from "../i18n/server"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { ownedBusiness } from "./owned-business"

// A link for a team member to join with their own account
// (docs/plans/team-accounts.md): emailed when they have an email; the
// owner can also share it (WhatsApp, copy). Not for someone who already
// joined.
export async function sendTeamInvite(
  businessId: string,
  teamMemberId: string
): Promise<{ ok: true; url: string; emailedTo: string | null } | { ok: false }> {
  const owned = await ownedBusiness(businessId)
  if (!owned || typeof teamMemberId !== "string") return { ok: false }
  if (!(await hasFeature(businessId, "teamAccounts"))) return { ok: false }
  const [member] = await db
    .select({ id: teamMembers.id, email: teamMembers.email, userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.id, teamMemberId), eq(teamMembers.businessId, businessId)))
    .limit(1)
  if (!member || member.userId) return { ok: false }
  const { url } = await createTeamInvite({
    businessId,
    teamMemberId: member.id,
    createdBy: owned.userId,
  })
  const emailed =
    !!member.email &&
    (await sendEmail({
      to: member.email,
      ...(await teamInviteEmail({
        businessName: owned.business.name,
        url,
        days: TEAM_RULES.inviteDays,
        language: await getOwnerLanguage(),
      })),
    }))
  return { ok: true, url, emailedTo: emailed ? member.email : null }
}

// Ends a team member's own access: their account no longer opens their
// team area, and any open link stops working. The team member stays.
export async function removeTeamAccess(
  businessId: string,
  teamMemberId: string
): Promise<{ ok: boolean }> {
  const owned = await ownedBusiness(businessId)
  if (!owned || typeof teamMemberId !== "string") return { ok: false }
  await saveAll([
    db
      .update(teamMembers)
      .set({ userId: null })
      .where(and(eq(teamMembers.id, teamMemberId), eq(teamMembers.businessId, businessId))),
    db
      .delete(teamInvites)
      .where(
        and(
          eq(teamInvites.teamMemberId, teamMemberId),
          eq(teamInvites.businessId, businessId),
          isNull(teamInvites.usedAt)
        )
      ),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
