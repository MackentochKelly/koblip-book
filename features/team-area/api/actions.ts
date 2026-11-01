"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getSession, requireTeamMember } from "@/lib/dal"
import { db } from "@/lib/db"
import { teamMembers } from "@/lib/db/schema"
import { joinWithTeamInvite } from "@/lib/team-invites"
import { checkTeamProfile, type TeamProfile } from "@/lib/team-rules"

// A team member saves their own profile: job title, about and languages.
// Their name, services and prices stay the owner's.
export async function saveMyProfile(
  teamMemberId: string,
  profile: TeamProfile
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof teamMemberId !== "string") return { ok: false, error: "not_found" }
  const { seat } = await requireTeamMember(teamMemberId)
  const checked = checkTeamProfile(profile)
  if (!checked.ok) return checked
  await db
    .update(teamMembers)
    .set(checked.values)
    .where(eq(teamMembers.id, seat.teamMemberId))
  revalidatePath(`/b/${seat.business.slug}`, "layout")
  revalidatePath(`/team/${seat.teamMemberId}`, "layout")
  return { ok: true }
}

// Joins with an invite link as the signed-in account, then opens the
// team area. Signed out (or a demo guest), it says so instead.
export async function joinTeam(
  token: string
): Promise<{ ok: false; reason: "signed-out" | "expired" | "taken" | "already-member" }> {
  const session = await getSession()
  if (!session || session.isGuest) return { ok: false, reason: "signed-out" }
  if (typeof token !== "string") return { ok: false, reason: "expired" }
  const result = await joinWithTeamInvite(token, session.userId)
  if (!result.ok) return result
  redirect(`/team/${result.teamMemberId}`)
}
