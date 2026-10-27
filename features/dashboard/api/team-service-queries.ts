import "server-only"

import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  businesses,
  businessPhotos,
  teamMembers,
  teamMemberServices,
} from "@/lib/db/schema"
import type { OwnerPhoto } from "../media-types"

async function ownedBusinessOrNotFound(businessId: string) {
  const session = await requireOwner()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId) {
    notFound()
  }
  return business
}

export async function getBusinessPhotos(
  businessId: string
): Promise<OwnerPhoto[]> {
  const business = await ownedBusinessOrNotFound(businessId)
  const rows = await db
    .select({ id: businessPhotos.id, url: businessPhotos.url })
    .from(businessPhotos)
    .where(eq(businessPhotos.businessId, business.id))
    .orderBy(asc(businessPhotos.position))
  return rows
}

export async function getServiceTeams(
  businessId: string
): Promise<Record<string, string[]>> {
  const business = await ownedBusinessOrNotFound(businessId)
  const [memberRows, linkRows] = await Promise.all([
    db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id))
      .orderBy(asc(teamMembers.position)),
    db
      .select({
        serviceId: teamMemberServices.serviceId,
        teamMemberId: teamMemberServices.teamMemberId,
      })
      .from(teamMemberServices)
      .where(eq(teamMemberServices.businessId, business.id)),
  ])
  const order = new Map(memberRows.map((row, index) => [row.id, index]))
  const result: Record<string, string[]> = {}
  for (const link of linkRows) {
    const list = result[link.serviceId] ?? []
    list.push(link.teamMemberId)
    result[link.serviceId] = list
  }
  for (const list of Object.values(result)) {
    list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  }
  return result
}
