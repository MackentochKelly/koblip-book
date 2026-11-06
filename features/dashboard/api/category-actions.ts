"use server"

import { and, eq, ne } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { serviceCategories, services } from "@/lib/db/schema"
import { revalidateBusiness } from "@/lib/revalidate-business"
import type { ActionResult } from "../types"
import { ownedBusiness } from "./owned-business"

// The owner's service categories (docs/plans/service-categories.md): add,
// rename, remove and reorder. A name is used once per business, whatever
// its capitals; "taken" says so.

function normalizeName(name: unknown): string | null {
  if (typeof name !== "string") {
    return null
  }
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (
    trimmed.length < 1 ||
    trimmed.length > BOOKING_RULES.maxServiceCategoryName
  ) {
    return null
  }
  return trimmed
}

function sameName(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase()
}

function categoriesOf(businessId: string, except?: string) {
  return db
    .select({
      id: serviceCategories.id,
      name: serviceCategories.name,
      position: serviceCategories.position,
    })
    .from(serviceCategories)
    .where(
      except
        ? and(
            eq(serviceCategories.businessId, businessId),
            ne(serviceCategories.id, except)
          )
        : eq(serviceCategories.businessId, businessId)
    )
}

async function addCategory(
  business: { id: string; slug: string },
  name: string
): Promise<ActionResult<{ id: string }>> {
  const existing = await categoriesOf(business.id)
  if (existing.some((category) => sameName(category.name, name))) {
    return { ok: false, error: "taken" }
  }
  if (existing.length >= BOOKING_RULES.maxServiceCategories) {
    return { ok: false, error: "invalid" }
  }
  const id = crypto.randomUUID()
  await db.insert(serviceCategories).values({
    id,
    businessId: business.id,
    name,
    position: existing.reduce(
      (last, category) => Math.max(last, category.position + 1),
      0
    ),
  })
  revalidateBusiness(business.slug)
  return { ok: true, id }
}

export async function createServiceCategory(
  businessId: string,
  name: string
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeName(name)
  if (!normalized) {
    return { ok: false, error: "invalid" }
  }
  return addCategory(owned.business, normalized)
}

// The category with this name (any capitals), added when there is none:
// for a suggested service that names its category.
export async function findOrAddServiceCategory(
  businessId: string,
  name: string
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeName(name)
  if (!normalized) {
    return { ok: false, error: "invalid" }
  }
  const found = (await categoriesOf(owned.business.id)).find((category) =>
    sameName(category.name, normalized)
  )
  if (found) {
    return { ok: true, id: found.id }
  }
  return addCategory(owned.business, normalized)
}

export async function renameServiceCategory(
  businessId: string,
  categoryId: string,
  name: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeName(name)
  if (!normalized) {
    return { ok: false, error: "invalid" }
  }
  const others = await categoriesOf(owned.business.id, categoryId)
  if (others.some((category) => sameName(category.name, normalized))) {
    return { ok: false, error: "taken" }
  }
  const renamed = await db
    .update(serviceCategories)
    .set({ name: normalized })
    .where(
      and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.businessId, owned.business.id)
      )
    )
    .returning({ id: serviceCategories.id })
  if (renamed.length === 0) {
    return { ok: false, error: "not_found" }
  }
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// Its services move to Other in the same write, never removed.
export async function deleteServiceCategory(
  businessId: string,
  categoryId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [category] = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!category) {
    return { ok: false, error: "not_found" }
  }
  await saveAll([
    db
      .update(services)
      .set({ categoryId: null })
      .where(
        and(
          eq(services.businessId, owned.business.id),
          eq(services.categoryId, category.id)
        )
      ),
    db.delete(serviceCategories).where(eq(serviceCategories.id, category.id)),
  ])
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// `ids`: every category of the business, in the new order.
export async function reorderServiceCategories(
  businessId: string,
  ids: string[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const existing = await categoriesOf(owned.business.id)
  const existingIds = new Set(existing.map((category) => category.id))
  if (
    !Array.isArray(ids) ||
    ids.length !== existing.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => existingIds.has(id))
  ) {
    return { ok: false, error: "invalid" }
  }
  await saveAll(
    ids.map((id, position) =>
      db
        .update(serviceCategories)
        .set({ position })
        .where(eq(serviceCategories.id, id))
    )
  )
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
