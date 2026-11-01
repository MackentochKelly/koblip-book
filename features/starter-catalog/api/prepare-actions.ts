"use server"

import { and, asc, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  addonGroups,
  addonOptions,
  businesses,
  serviceAddonGroups,
  services,
  teamMembers,
} from "@/lib/db/schema"
import { isMetaAiEnabled } from "@/lib/meta-ai"
import { deletePhoto } from "@/lib/uploads"
import type { StarterResult, StarterSummary } from "../types"
import { draftCatalog } from "./draft-catalog"
import { drawPortrait } from "./draw-portrait"

// The signed-in owner's own real business (never a demo copy), or null.
// The id comes from the browser, so ownership is checked here.
async function ownedBusiness(businessId: unknown) {
  if (typeof businessId !== "string" || !businessId) {
    return null
  }
  const session = await requireOwner()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId || business.isDemo) {
    return null
  }
  return { business, userId: session.userId }
}

async function currentSummary(
  businessId: string,
  currency: string,
  role: string | null,
  created: boolean
): Promise<StarterSummary> {
  const [serviceRows, optionRows, teamRows] = await Promise.all([
    db
      .select({ name: services.name, priceMinor: services.priceMinor })
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(asc(services.position)),
    db
      .select({ name: addonOptions.name })
      .from(addonOptions)
      .where(eq(addonOptions.businessId, businessId))
      .orderBy(asc(addonOptions.position)),
    db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        photoUrl: teamMembers.photoUrl,
      })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, businessId))
      .orderBy(asc(teamMembers.position)),
  ])
  return {
    currency,
    services: serviceRows,
    extras: optionRows.map((row) => row.name),
    team: teamRows,
    role,
    created,
  }
}

async function hasCatalog(businessId: string): Promise<boolean> {
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

// Right after sign-up: Meta AI writes the business's services, extras,
// prices and team from its Google details, and they go live at once. A
// business that already has services or team is never changed.
export async function startStarterCatalog(
  businessId: string
): Promise<StarterResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const { business } = owned
  if (await hasCatalog(business.id)) {
    return {
      ok: true,
      summary: await currentSummary(business.id, business.currency, null, false),
    }
  }
  if (!isMetaAiEnabled()) {
    return { ok: false, error: "ai_off" }
  }
  const catalog = await draftCatalog({
    name: business.name,
    category: business.category,
    address: business.address,
    currency: business.currency,
    description: business.description,
  })
  if (!catalog) {
    return { ok: false, error: "failed" }
  }
  // The owner may have added something while Meta AI was writing.
  if (await hasCatalog(business.id)) {
    return {
      ok: true,
      summary: await currentSummary(business.id, business.currency, null, false),
    }
  }

  const serviceIds = catalog.services.map(() => crypto.randomUUID())
  const groupId = crypto.randomUUID()
  await saveAll([
    db.insert(services).values(
      catalog.services.map((service, position) => ({
        id: serviceIds[position],
        businessId: business.id,
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
    // No team_member_services rows: everyone does every service.
    db.insert(teamMembers).values(
      catalog.team.members.map((member, position) => ({
        businessId: business.id,
        name: member.name,
        description: member.description || null,
        position,
      }))
    ),
  ])
  revalidatePath("/b/" + business.slug)
  return {
    ok: true,
    summary: await currentSummary(
      business.id,
      business.currency,
      catalog.team.role,
      true
    ),
  }
}

// Muse Image draws one team member's photo. Only for a member of the
// owner's business who has no photo yet, so a photo is never replaced and
// a second call costs nothing.
export async function drawTeamPhoto(
  businessId: string,
  memberId: string
): Promise<{ ok: true; photoUrl: string } | { ok: false }> {
  const owned = await ownedBusiness(businessId)
  if (!owned || typeof memberId !== "string") {
    return { ok: false }
  }
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.businessId, owned.business.id),
        isNull(teamMembers.photoUrl)
      )
    )
    .limit(1)
  if (!member) {
    return { ok: false }
  }
  const photoUrl = await drawPortrait(
    {
      name: member.name,
      description: member.description,
      category: owned.business.category,
    },
    owned.userId
  )
  if (!photoUrl) {
    return { ok: false }
  }
  const saved = await db
    .update(teamMembers)
    .set({ photoUrl })
    .where(and(eq(teamMembers.id, member.id), isNull(teamMembers.photoUrl)))
    .returning({ id: teamMembers.id })
  if (saved.length === 0) {
    // Another call gave this member a photo first: keep that one.
    await deletePhoto(photoUrl)
    return { ok: false }
  }
  revalidatePath("/b/" + owned.business.slug)
  return { ok: true, photoUrl }
}
