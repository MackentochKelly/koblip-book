import "server-only"
import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  businesses,
  serviceAddonGroups,
  services,
} from "@/lib/db/schema"
import type { OwnerAddonGroup } from "../types"

async function ownedBusiness(businessId: string) {
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

export async function getAddonGroups(
  businessId: string
): Promise<OwnerAddonGroup[]> {
  const business = await ownedBusiness(businessId)
  const [groupRows, optionRows, linkRows, serviceRows] = await Promise.all([
    db
      .select()
      .from(addonGroups)
      .where(eq(addonGroups.businessId, business.id))
      .orderBy(asc(addonGroups.position)),
    db
      .select()
      .from(addonOptions)
      .where(eq(addonOptions.businessId, business.id))
      .orderBy(asc(addonOptions.position)),
    db
      .select()
      .from(serviceAddonGroups)
      .where(eq(serviceAddonGroups.businessId, business.id)),
    db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(asc(services.position)),
  ])
  const serviceOrder = new Map(serviceRows.map((row, index) => [row.id, index]))
  return groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    prompt: group.prompt,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    serviceIds: linkRows
      .filter((link) => link.groupId === group.id)
      .map((link) => link.serviceId)
      .sort((a, b) => (serviceOrder.get(a) ?? 0) - (serviceOrder.get(b) ?? 0)),
    options: optionRows
      .filter((option) => option.groupId === group.id)
      .map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description,
        priceMinor: option.priceMinor,
        durationMinutes: option.durationMinutes,
      })),
  }))
}
