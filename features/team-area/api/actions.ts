"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getSession, requireTeamMember } from "@/lib/dal"
import { db } from "@/lib/db"
import { teamMembers } from "@/lib/db/schema"
import { joinWithTeamInvite } from "@/lib/team-invites"
import {
  checkStartingCounts,
  checkTeamProfile,
  type StartingCounts,
  type TeamProfile,
} from "@/lib/team-rules"
import { translateBusinessSoon } from "@/lib/translations/business-texts"
import { deletePhoto, savePhoto } from "@/lib/uploads"
import type { PhotoResult } from "@/types/photo"

// A team member saves their own profile: job title, about, languages and
// their numbers from before Koblip. Their name, services and prices stay
// the owner's.
export async function saveMyProfile(
  teamMemberId: string,
  profile: TeamProfile & StartingCounts
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof teamMemberId !== "string") return { ok: false, error: "not_found" }
  const { seat } = await requireTeamMember(teamMemberId)
  const checked = checkTeamProfile(profile)
  if (!checked.ok) return checked
  const counts = checkStartingCounts(profile)
  if (!counts.ok) return counts
  await db
    .update(teamMembers)
    .set({ ...checked.values, ...counts.values })
    .where(eq(teamMembers.id, seat.teamMemberId))
  revalidatePath(`/b/${seat.business.slug}`, "layout")
  revalidatePath(`/team/${seat.teamMemberId}`, "layout")
  translateBusinessSoon(seat.business.id)
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

// A team member changes their own photo; the old file goes once the new
// one is saved.
export async function setMyPhoto(
  teamMemberId: string,
  formData: FormData
): Promise<PhotoResult<{ photoUrl: string }>> {
  if (typeof teamMemberId !== "string") return { ok: false, error: "not_found" }
  const { seat } = await requireTeamMember(teamMemberId)
  const saved = await savePhoto(formData.get("file") as File)
  if (!saved.ok) return { ok: false, error: saved.error }
  try {
    await db
      .update(teamMembers)
      .set({ photoUrl: saved.url })
      .where(eq(teamMembers.id, seat.teamMemberId))
  } catch (error) {
    await deletePhoto(saved.url)
    throw error
  }
  await deletePhoto(seat.photoUrl)
  revalidatePath(`/b/${seat.business.slug}`, "layout")
  revalidatePath(`/team/${seat.teamMemberId}`, "layout")
  return { ok: true, photoUrl: saved.url }
}

// A team member takes their own photo off.
export async function removeMyPhoto(teamMemberId: string): Promise<PhotoResult> {
  if (typeof teamMemberId !== "string") return { ok: false, error: "not_found" }
  const { seat } = await requireTeamMember(teamMemberId)
  await db
    .update(teamMembers)
    .set({ photoUrl: null })
    .where(eq(teamMembers.id, seat.teamMemberId))
  await deletePhoto(seat.photoUrl)
  revalidatePath(`/b/${seat.business.slug}`, "layout")
  revalidatePath(`/team/${seat.teamMemberId}`, "layout")
  return { ok: true }
}
