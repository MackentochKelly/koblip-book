"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { teamMemberHours, teamMembers } from "@/lib/db/schema"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { validHours, type HoursRow } from "@/lib/hours-rules"
import type { ActionResult } from "../types"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

// null means inherit; an empty custom week cannot be represented by no rows.
export async function saveTeamMemberWithHours(
  businessId: string,
  memberId: string | null,
  name: string,
  rows: HoursRow[] | null
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (rows !== null && (!validHours(rows) || rows.length === 0))
    return { ok: false, error: "invalid" }
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > BOOKING_RULES.maxTeamName
  )
    return { ok: false, error: "invalid" }
  const members = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.businessId, owned.business.id))
  if (memberId !== null && !members.some((member) => member.id === memberId))
    return { ok: false, error: "not_found" }
  if (memberId === null && members.length >= BOOKING_RULES.maxTeam)
    return { ok: false, error: "invalid" }
  const id = memberId ?? crypto.randomUUID()
  await saveAll([
    memberId === null
      ? db.insert(teamMembers).values({
          id,
          businessId: owned.business.id,
          name: name.trim(),
          position: members.length,
        })
      : db
          .update(teamMembers)
          .set({ name: name.trim() })
          .where(
            and(
              eq(teamMembers.id, id),
              eq(teamMembers.businessId, owned.business.id)
            )
          ),
    db
      .delete(teamMemberHours)
      .where(
        and(
          eq(teamMemberHours.businessId, owned.business.id),
          eq(teamMemberHours.teamMemberId, id)
        )
      ),
    ...(rows
      ? [
          db.insert(teamMemberHours).values(
            rows.map((row) => ({
              businessId: owned.business.id,
              teamMemberId: id,
              weekday: row.weekday,
              opensAt: row.opensAt,
              closesAt: row.closesAt,
            }))
          ),
        ]
      : []),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
