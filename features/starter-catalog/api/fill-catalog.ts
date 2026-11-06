import "server-only"

import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  addonGroups,
  addonOptions,
  type businesses,
  serviceAddonGroups,
  serviceCategories,
  services,
  teamMembers,
} from "@/lib/db/schema"
import { deletePhoto } from "@/lib/uploads"
import { randomStartingCounts } from "@/lib/team-rules"
import type { StarterSummary } from "../types"
import type { CheckedCatalog } from "../utils/check-catalog"
import { draftCatalog } from "./draft-catalog"
import { drawPortrait } from "./draw-portrait"

// The work behind the setup screen's actions and the refill script, with
// no session check: callers check who may run it.

type Business = typeof businesses.$inferSelect

export async function hasCatalog(businessId: string): Promise<boolean> {
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.businessId, businessId))
    .limit(1)
  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.businessId, businessId))
    .limit(1)
  return Boolean(service || member)
}

export async function catalogSummary(
  business: Business,
  role: string | null,
  created: boolean
): Promise<StarterSummary> {
  const [serviceRows, optionRows, teamRows] = await Promise.all([
    db
      .select({ name: services.name, priceMinor: services.priceMinor })
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(asc(services.position)),
    db
      .select({ name: addonOptions.name })
      .from(addonOptions)
      .where(eq(addonOptions.businessId, business.id))
      .orderBy(asc(addonOptions.position)),
    db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        photoUrl: teamMembers.photoUrl,
      })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id))
      .orderBy(asc(teamMembers.position)),
  ])
  return {
    currency: business.currency,
    services: serviceRows,
    extras: optionRows.map((row) => row.name),
    team: teamRows,
    role,
    created,
  }
}

// Muse Spark's checked catalog for this business, or null.
export function draftFor(business: Business): Promise<CheckedCatalog | null> {
  return draftCatalog({
    name: business.name,
    category: business.category,
    address: business.address,
    currency: business.currency,
    description: business.description,
  })
}

// The writes for a catalog: its service categories in the order they
// first come (check-catalog keeps them only when there are enough, each
// spelled one way), services, one extras group offered on every service,
// and the team (no team_member_services rows, so everyone does every
// service).
function catalogInserts(business: Business, catalog: CheckedCatalog) {
  const categoryIds = new Map<string, string>()
  for (const service of catalog.services) {
    if (service.category !== null && !categoryIds.has(service.category)) {
      categoryIds.set(service.category, crypto.randomUUID())
    }
  }
  const serviceIds = catalog.services.map(() => crypto.randomUUID())
  const groupId = crypto.randomUUID()
  return [
    // Before the services, which point at them.
    ...(categoryIds.size > 0
      ? [
          db.insert(serviceCategories).values(
            [...categoryIds].map(([name, id], position) => ({
              id,
              businessId: business.id,
              name,
              position,
            }))
          ),
        ]
      : []),
    db.insert(services).values(
      catalog.services.map((service, position) => ({
        id: serviceIds[position],
        businessId: business.id,
        categoryId:
          service.category === null
            ? null
            : (categoryIds.get(service.category) ?? null),
        name: service.name,
        description: service.description || null,
        durationMinutes: service.durationMinutes,
        priceMinor: service.priceMinor,
        position,
      }))
    ),
    db.insert(addonGroups).values({
      id: groupId,
      businessId: business.id,
      name: catalog.extras.name,
      prompt: catalog.extras.prompt,
    }),
    db.insert(addonOptions).values(
      catalog.extras.options.map((option, position) => ({
        businessId: business.id,
        groupId,
        name: option.name,
        description: option.description || null,
        durationMinutes: option.durationMinutes,
        priceMinor: option.priceMinor,
        position,
      }))
    ),
    db.insert(serviceAddonGroups).values(
      serviceIds.map((serviceId) => ({
        businessId: business.id,
        serviceId,
        groupId,
      }))
    ),
    db.insert(teamMembers).values(
      catalog.team.members.map((member, position) => ({
        businessId: business.id,
        name: member.name,
        description: member.description || null,
        position,
        ...randomStartingCounts(),
      }))
    ),
  ]
}

// Saves the catalog in one batch.
export async function writeCatalog(
  business: Business,
  catalog: CheckedCatalog
): Promise<void> {
  await saveAll(catalogInserts(business, catalog))
}

// Muse Image draws a photo for a member of this business who has none
// yet, so a photo is never replaced. The photo URL, or null.
export async function drawMemberPhoto(
  business: Business,
  memberId: string,
  userId: string
): Promise<string | null> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.businessId, business.id),
        isNull(teamMembers.photoUrl)
      )
    )
    .limit(1)
  if (!member) {
    return null
  }
  const photoUrl = await drawPortrait(
    {
      name: member.name,
      description: member.description,
      category: business.category,
      position: member.position,
    },
    userId
  )
  if (!photoUrl) {
    return null
  }
  const saved = await db
    .update(teamMembers)
    .set({ photoUrl })
    .where(and(eq(teamMembers.id, member.id), isNull(teamMembers.photoUrl)))
    .returning({ id: teamMembers.id })
  if (saved.length === 0) {
    // Another call gave this member a photo first: keep that one.
    await deletePhoto(photoUrl)
    return null
  }
  return photoUrl
}

// Swaps a business's services, service categories, extras and team for
// the catalog in one batch, so it ends with the old one or the new one,
// never neither. The old items' links, hours and calendar links go with
// them; bookings keep their own copies of the names. Then the old photo
// files are removed. For the refill script only.
export async function replaceCatalog(
  business: Business,
  catalog: CheckedCatalog
): Promise<void> {
  const [serviceRows, teamRows] = await Promise.all([
    db
      .select({ photoUrl: services.photoUrl })
      .from(services)
      .where(eq(services.businessId, business.id)),
    db
      .select({ photoUrl: teamMembers.photoUrl })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id)),
  ])
  await saveAll([
    db.delete(services).where(eq(services.businessId, business.id)),
    db
      .delete(serviceCategories)
      .where(eq(serviceCategories.businessId, business.id)),
    db.delete(addonGroups).where(eq(addonGroups.businessId, business.id)),
    db.delete(teamMembers).where(eq(teamMembers.businessId, business.id)),
    ...catalogInserts(business, catalog),
  ])
  for (const row of [...serviceRows, ...teamRows]) {
    await deletePhoto(row.photoUrl)
  }
}
