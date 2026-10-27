"use server"

import { and, eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  serviceAddonGroups,
  services,
} from "@/lib/db/schema"
import type {
  ActionResult,
  AddonGroupInput,
  AddonOptionInput,
} from "../types"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

function invalid(): { ok: false; error: string } {
  return { ok: false, error: "invalid" }
}

interface NormalizedOption {
  id: string | null
  name: string
  description: string | null
  priceMinor: number | null
  durationMinutes: number
}

interface NormalizedGroup {
  name: string
  prompt: string
  minSelect: number
  maxSelect: number | null
  serviceIds: string[]
  options: NormalizedOption[]
}

function normalizeOption(input: AddonOptionInput): NormalizedOption | null {
  if (!input || typeof input !== "object") {
    return null
  }
  const name = input.name.trim()
  if (name.length < 1 || name.length > BOOKING_RULES.maxAddonName) {
    return null
  }
  let description: string | null = null
  if (input.description !== null) {
    if (typeof input.description !== "string") {
      return null
    }
    const trimmed = input.description.trim()
    if (trimmed !== "") {
      if (trimmed.length > BOOKING_RULES.maxAddonDescription) {
        return null
      }
      description = trimmed
    }
  }
  if (
    input.priceMinor !== null &&
    (!Number.isInteger(input.priceMinor) ||
      (input.priceMinor as number) < 0 ||
      (input.priceMinor as number) > BOOKING_RULES.maxPriceMinor)
  ) {
    return null
  }
  if (
    !(BOOKING_RULES.addonMinutes as readonly number[]).includes(
      input.durationMinutes
    )
  ) {
    return null
  }
  return {
    id: input.id,
    name,
    description,
    priceMinor: input.priceMinor,
    durationMinutes: input.durationMinutes,
  }
}

function normalizeGroupInput(
  input: AddonGroupInput,
  businessServiceIds: Set<string>
): NormalizedGroup | null {
  if (!input || typeof input !== "object") {
    return null
  }
  const name = input.name.trim()
  if (name.length < 1 || name.length > BOOKING_RULES.maxAddonName) {
    return null
  }
  const prompt = input.prompt.trim()
  if (prompt.length < 1 || prompt.length > BOOKING_RULES.maxAddonPrompt) {
    return null
  }
  if (
    !Array.isArray(input.options) ||
    input.options.length < 1 ||
    input.options.length > BOOKING_RULES.maxAddonOptions
  ) {
    return null
  }
  const options: NormalizedOption[] = []
  for (const option of input.options) {
    const normalized = normalizeOption(option)
    if (!normalized) {
      return null
    }
    options.push(normalized)
  }
  if (
    !Number.isInteger(input.minSelect) ||
    input.minSelect < 0 ||
    input.minSelect > options.length
  ) {
    return null
  }
  if (input.maxSelect !== null) {
    if (
      !Number.isInteger(input.maxSelect) ||
      input.maxSelect < Math.max(1, input.minSelect) ||
      input.maxSelect > options.length
    ) {
      return null
    }
  }
  if (
    !Array.isArray(input.serviceIds) ||
    new Set(input.serviceIds).size !== input.serviceIds.length ||
    !input.serviceIds.every(
      (id) => typeof id === "string" && businessServiceIds.has(id)
    )
  ) {
    return null
  }
  return {
    name,
    prompt,
    minSelect: input.minSelect,
    maxSelect: input.maxSelect,
    serviceIds: input.serviceIds,
    options,
  }
}

async function businessServiceIds(businessId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.businessId, businessId))
  return new Set(rows.map((row) => row.id))
}

export async function createAddonGroup(
  businessId: string,
  input: AddonGroupInput
): Promise<ActionResult<{ groupId: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [existing, serviceIds] = await Promise.all([
    db
      .select({ id: addonGroups.id })
      .from(addonGroups)
      .where(eq(addonGroups.businessId, owned.business.id)),
    businessServiceIds(owned.business.id),
  ])
  if (existing.length >= BOOKING_RULES.maxAddonGroups) {
    return invalid()
  }
  const normalized = normalizeGroupInput(input, serviceIds)
  if (!normalized) {
    return invalid()
  }
  const groupId = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(addonGroups).values({
      id: groupId,
      businessId: owned.business.id,
      name: normalized.name,
      prompt: normalized.prompt,
      minSelect: normalized.minSelect,
      maxSelect: normalized.maxSelect,
      position: existing.length,
    })
    await tx.insert(addonOptions).values(
      normalized.options.map((option, index) => ({
        id: crypto.randomUUID(),
        businessId: owned.business.id,
        groupId,
        name: option.name,
        description: option.description,
        priceMinor: option.priceMinor,
        durationMinutes: option.durationMinutes,
        position: index,
      }))
    )
    if (normalized.serviceIds.length > 0) {
      await tx.insert(serviceAddonGroups).values(
        normalized.serviceIds.map((serviceId, index) => ({
          businessId: owned.business.id,
          serviceId,
          groupId,
          position: index,
        }))
      )
    }
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true, groupId }
}

export async function updateAddonGroup(
  businessId: string,
  groupId: string,
  input: AddonGroupInput
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [group] = await db
    .select({ id: addonGroups.id })
    .from(addonGroups)
    .where(
      and(
        eq(addonGroups.id, groupId),
        eq(addonGroups.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!group) {
    return { ok: false, error: "not_found" }
  }
  const serviceIds = await businessServiceIds(owned.business.id)
  const normalized = normalizeGroupInput(input, serviceIds)
  if (!normalized) {
    return invalid()
  }
  const currentOptions = await db
    .select({ id: addonOptions.id })
    .from(addonOptions)
    .where(eq(addonOptions.groupId, group.id))
  const currentIds = new Set(currentOptions.map((row) => row.id))
  const seen = new Set<string>()
  for (const option of normalized.options) {
    if (option.id !== null) {
      if (typeof option.id !== "string" || !currentIds.has(option.id)) {
        return invalid()
      }
      if (seen.has(option.id)) {
        return invalid()
      }
      seen.add(option.id)
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .update(addonGroups)
      .set({
        name: normalized.name,
        prompt: normalized.prompt,
        minSelect: normalized.minSelect,
        maxSelect: normalized.maxSelect,
      })
      .where(eq(addonGroups.id, group.id))
    for (const [index, option] of normalized.options.entries()) {
      if (option.id !== null) {
        await tx
          .update(addonOptions)
          .set({
            name: option.name,
            description: option.description,
            priceMinor: option.priceMinor,
            durationMinutes: option.durationMinutes,
            position: index,
          })
          .where(eq(addonOptions.id, option.id))
      } else {
        await tx.insert(addonOptions).values({
          id: crypto.randomUUID(),
          businessId: owned.business.id,
          groupId: group.id,
          name: option.name,
          description: option.description,
          priceMinor: option.priceMinor,
          durationMinutes: option.durationMinutes,
          position: index,
        })
      }
    }
    for (const row of currentOptions) {
      if (!seen.has(row.id)) {
        await tx.delete(addonOptions).where(eq(addonOptions.id, row.id))
      }
    }
    await tx
      .delete(serviceAddonGroups)
      .where(eq(serviceAddonGroups.groupId, group.id))
    if (normalized.serviceIds.length > 0) {
      await tx.insert(serviceAddonGroups).values(
        normalized.serviceIds.map((serviceId, index) => ({
          businessId: owned.business.id,
          serviceId,
          groupId: group.id,
          position: index,
        }))
      )
    }
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function deleteAddonGroup(
  businessId: string,
  groupId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [group] = await db
    .select({ id: addonGroups.id })
    .from(addonGroups)
    .where(
      and(
        eq(addonGroups.id, groupId),
        eq(addonGroups.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!group) {
    return { ok: false, error: "not_found" }
  }
  await db.transaction(async (tx) => {
    await tx.delete(addonGroups).where(eq(addonGroups.id, group.id))
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function reorderAddonGroups(
  businessId: string,
  groupIds: string[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const existing = await db
    .select({ id: addonGroups.id })
    .from(addonGroups)
    .where(eq(addonGroups.businessId, owned.business.id))
  const existingIds = new Set(existing.map((row) => row.id))
  if (
    !Array.isArray(groupIds) ||
    groupIds.length !== existing.length ||
    new Set(groupIds).size !== groupIds.length ||
    !groupIds.every((id) => existingIds.has(id))
  ) {
    return invalid()
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of groupIds.entries()) {
      await tx
        .update(addonGroups)
        .set({ position })
        .where(eq(addonGroups.id, id))
    }
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
