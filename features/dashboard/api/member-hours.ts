"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { teamMemberHours, teamMembers } from "@/lib/db/schema"
import {
  BOOKING_RULES,
  EMAIL_PATTERN,
  PHONE_PATTERN,
} from "@/lib/booking-rules"
import { validHours, type HoursRow } from "@/lib/hours-rules"
import type { ActionResult } from "../types"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

export interface TeamMemberDetails {
  name: string
  phone: string | null // owner only
  email: string | null // owner only
  description: string | null // customers see it when they book
}

// Trimmed text, null when empty; undefined when it is not text at all.
function optionalText(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== "string") return undefined
  return value.trim() === "" ? null : value.trim()
}

// Checks a person's details. The error names the field that is wrong.
function checkDetails(
  details: TeamMemberDetails
): { ok: true; values: TeamMemberDetails } | { ok: false; error: string } {
  const name = typeof details?.name === "string" ? details.name.trim() : ""
  if (!name || name.length > BOOKING_RULES.maxTeamName)
    return { ok: false, error: "name" }
  const phone = optionalText(details.phone)
  if (phone === undefined || (phone !== null && !PHONE_PATTERN.test(phone)))
    return { ok: false, error: "phone" }
  const email = optionalText(details.email)
  if (
    email === undefined ||
    (email !== null &&
      (email.length > BOOKING_RULES.maxEmail || !EMAIL_PATTERN.test(email)))
  )
    return { ok: false, error: "email" }
  const description = optionalText(details.description)
  if (
    description === undefined ||
    (description !== null &&
      description.length > BOOKING_RULES.maxTeamDescription)
  )
    return { ok: false, error: "description" }
  return { ok: true, values: { name, phone, email, description } }
}

// Adds a person (memberId null) or saves one: their details and hours.
// Hours null means the business's hours; an empty custom week cannot be
// represented by no rows. Answers with the person's id, so a photo picked
// while adding them can be uploaded next.
export async function saveTeamMemberWithHours(
  businessId: string,
  memberId: string | null,
  details: TeamMemberDetails,
  rows: HoursRow[] | null
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  if (rows !== null && (!validHours(rows) || rows.length === 0))
    return { ok: false, error: "invalid" }
  const checked = checkDetails(details)
  if (!checked.ok) return checked
  const values = checked.values
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
          ...values,
          position: members.length,
        })
      : db
          .update(teamMembers)
          .set(values)
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
  return { ok: true, id }
}
