"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  services,
  teamMembers,
  teamMemberServices,
} from "@/lib/db/schema"
import type { ActionResult } from "../types"
import { planMemberServiceRows, planServiceTeamRows } from "../utils/team-service-plan"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

export async function setServiceTeam(
  businessId: string,
  serviceId: string,
  teamMemberIds: string[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!service) {
    return { ok: false, error: "invalid" }
  }
  const members = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.businessId, owned.business.id))
  const planned = planServiceTeamRows(
    members.map((row) => row.id),
    teamMemberIds
  )
  if (!planned.ok) {
    return planned
  }
  await saveAll([
    db
      .delete(teamMemberServices)
      .where(eq(teamMemberServices.serviceId, service.id)),
    ...(planned.rows.length > 0
      ? [
          db.insert(teamMemberServices).values(
            planned.rows.map((teamMemberId) => ({
              businessId: owned.business.id,
              teamMemberId,
              serviceId: service.id,
            }))
          ),
        ]
      : []),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function setMemberServices(
  businessId: string,
  teamMemberId: string,
  serviceIds: string[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [memberRows, serviceRows, linkRows] = await Promise.all([
    db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, owned.business.id)),
    db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.businessId, owned.business.id)),
    db
      .select({
        serviceId: teamMemberServices.serviceId,
        teamMemberId: teamMemberServices.teamMemberId,
      })
      .from(teamMemberServices)
      .where(eq(teamMemberServices.businessId, owned.business.id)),
  ])
  const currentRows: Record<string, string[]> = {}
  for (const link of linkRows) {
    const list = currentRows[link.serviceId] ?? []
    list.push(link.teamMemberId)
    currentRows[link.serviceId] = list
  }
  const planned = planMemberServiceRows({
    serviceIds: serviceRows.map((row) => row.id),
    teamMemberIds: memberRows.map((row) => row.id),
    currentRows,
    teamMemberId,
    serviceIdsWanted: serviceIds,
  })
  if (!planned.ok) {
    return planned
  }
  const entries = Object.entries(planned.rows)
  const values = entries.flatMap(([serviceId, memberIds]) =>
    memberIds.map((id) => ({
      businessId: owned.business.id,
      teamMemberId: id,
      serviceId,
    }))
  )
  await saveAll([
    db
      .delete(teamMemberServices)
      .where(eq(teamMemberServices.businessId, owned.business.id)),
    ...(values.length > 0
      ? [db.insert(teamMemberServices).values(values)]
      : []),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
