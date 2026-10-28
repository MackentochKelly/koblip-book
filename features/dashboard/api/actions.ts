"use server"

import { and, eq, gte } from "drizzle-orm"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  bookings,
  businessHours,
  businesses,
  services,
  teamMembers,
} from "@/lib/db/schema"
import { getMetaAiClient, isMetaAiEnabled, META_TEXT_MODEL } from "@/lib/meta-ai"
import { isPageLanguage, type PageLanguage } from "@/lib/page-language"
import type {
  ActionResult,
  BusinessDetailsInput,
  HoursRow,
  ServiceInput,
  ServiceSuggestion,
} from "../types"
import { claimBusinessForUser } from "./claim"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function invalid(): { ok: false; error: string } {
  return { ok: false, error: "invalid" }
}

export async function updateBusinessDetails(
  businessId: string,
  input: BusinessDetailsInput
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const name = input.name.trim()
  if (name === "" || name.length > BOOKING_RULES.maxBusinessName) {
    return invalid()
  }
  const address =
    input.address === null ? null : input.address.trim() || null
  if (address !== null && address.length > BOOKING_RULES.maxBusinessAddress) {
    return invalid()
  }
  const description =
    input.description === null ? null : input.description.trim() || null
  if (description !== null && description.length > BOOKING_RULES.maxBusinessDescription) {
    return invalid()
  }
  const phone =
    input.phone === null ? null : input.phone.trim() || null
  if (phone !== null && !PHONE_PATTERN.test(phone)) {
    return invalid()
  }
  let website: string | null = null
  if (input.website !== null) {
    const trimmed = input.website.trim()
    if (trimmed !== "") {
      let url: URL
      try {
        url = new URL(trimmed)
      } catch {
        return invalid()
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return invalid()
      }
      website = trimmed
    }
  }
  if (
    !Number.isInteger(input.seats) ||
    input.seats < 1 ||
    input.seats > BOOKING_RULES.maxSeats
  ) {
    return invalid()
  }
  await db
    .update(businesses)
    .set({
      name,
      address,
      description,
      phone,
      website,
      seats: input.seats,
      detailsConfirmedAt: Date.now(),
    })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// The owner confirms the imported details are theirs. From then on the
// name, phone, address, website, category, status, timezone and hours are
// the owner's own details, not Google's.
export async function confirmBusinessDetails(
  businessId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  await db
    .update(businesses)
    .set({ detailsConfirmedAt: Date.now() })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function saveHours(
  businessId: string,
  rows: HoursRow[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (!Array.isArray(rows) || rows.length > BOOKING_RULES.maxHoursRows) {
    return invalid()
  }
  for (const row of rows) {
    if (
      !row ||
      !Number.isInteger(row.weekday) ||
      row.weekday < 0 ||
      row.weekday > 6 ||
      typeof row.opensAt !== "string" ||
      typeof row.closesAt !== "string" ||
      !TIME_PATTERN.test(row.opensAt) ||
      !TIME_PATTERN.test(row.closesAt)
    ) {
      return invalid()
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(businessHours)
      .where(eq(businessHours.businessId, owned.business.id))
    if (rows.length > 0) {
      await tx.insert(businessHours).values(
        rows.map((row) => ({
          businessId: owned.business.id,
          weekday: row.weekday,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
        }))
      )
    }
    await tx
      .update(businesses)
      .set({ detailsConfirmedAt: Date.now() })
      .where(eq(businesses.id, owned.business.id))
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

function normalizeServiceInput(input: ServiceInput) {
  const name = input.name.trim()
  if (name.length < 1 || name.length > BOOKING_RULES.maxServiceName) {
    return null
  }
  const description =
    input.description === null ? null : input.description.trim() || null
  if (
    description !== null &&
    description.length > BOOKING_RULES.maxServiceDescription
  ) {
    return null
  }
  if (
    !(BOOKING_RULES.serviceMinutes as readonly number[]).includes(
      input.durationMinutes
    )
  ) {
    return null
  }
  if (
    input.priceMinor !== null &&
    (!Number.isInteger(input.priceMinor) ||
      input.priceMinor < 0 ||
      input.priceMinor > BOOKING_RULES.maxPriceMinor)
  ) {
    return null
  }
  return { name, description, durationMinutes: input.durationMinutes, priceMinor: input.priceMinor }
}

export async function createService(
  businessId: string,
  input: ServiceInput
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeServiceInput(input)
  if (!normalized) {
    return invalid()
  }
  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.businessId, owned.business.id))
  if (existing.length >= BOOKING_RULES.maxServices) {
    return invalid()
  }
  const id = crypto.randomUUID()
  await db.insert(services).values({
    id,
    businessId: owned.business.id,
    ...normalized,
    position: existing.length,
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true, id }
}

export async function updateService(
  businessId: string,
  serviceId: string,
  input: ServiceInput
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeServiceInput(input)
  if (!normalized) {
    return invalid()
  }
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(eq(services.id, serviceId), eq(services.businessId, owned.business.id))
    )
    .limit(1)
  if (!service) {
    return { ok: false, error: "not_found" }
  }
  await db
    .update(services)
    .set(normalized)
    .where(eq(services.id, service.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function deleteService(
  businessId: string,
  serviceId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(eq(services.id, serviceId), eq(services.businessId, owned.business.id))
    )
    .limit(1)
  if (!service) {
    return { ok: false, error: "not_found" }
  }
  await db.delete(services).where(eq(services.id, service.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function reorderServices(
  businessId: string,
  ids: string[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.businessId, owned.business.id))
  const existingIds = new Set(existing.map((row) => row.id))
  if (
    !Array.isArray(ids) ||
    ids.length !== existing.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => existingIds.has(id))
  ) {
    return invalid()
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(services)
        .set({ position })
        .where(eq(services.id, id))
    }
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

function normalizeTeamName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > BOOKING_RULES.maxTeamName) {
    return null
  }
  return trimmed
}

export async function createTeamMember(
  businessId: string,
  name: string
): Promise<ActionResult<{ id: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeTeamName(name)
  if (!normalized) {
    return invalid()
  }
  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.businessId, owned.business.id))
  if (existing.length >= BOOKING_RULES.maxTeam) {
    return invalid()
  }
  const id = crypto.randomUUID()
  await db.insert(teamMembers).values({
    id,
    businessId: owned.business.id,
    name: normalized,
    position: existing.length,
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true, id }
}

export async function renameTeamMember(
  businessId: string,
  memberId: string,
  name: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const normalized = normalizeTeamName(name)
  if (!normalized) {
    return invalid()
  }
  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!member) {
    return { ok: false, error: "not_found" }
  }
  await db
    .update(teamMembers)
    .set({ name: normalized })
    .where(eq(teamMembers.id, member.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function deleteTeamMember(
  businessId: string,
  memberId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [member] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!member) {
    return { ok: false, error: "not_found" }
  }
  const now = new Date().toISOString()
  const [upcoming] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.businessId, owned.business.id),
        eq(bookings.teamMemberId, member.id),
        eq(bookings.status, "confirmed"),
        gte(bookings.endAt, now)
      )
    )
    .limit(1)
  if (upcoming) {
    return { ok: false, error: "has_bookings" }
  }
  await db.delete(teamMembers).where(eq(teamMembers.id, member.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function reorderTeam(
  businessId: string,
  ids: string[]
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.businessId, owned.business.id))
  const existingIds = new Set(existing.map((row) => row.id))
  if (
    !Array.isArray(ids) ||
    ids.length !== existing.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => existingIds.has(id))
  ) {
    return invalid()
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(teamMembers)
        .set({ position })
        .where(eq(teamMembers.id, id))
    }
  })
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function cancelBooking(
  businessId: string,
  bookingId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!booking) {
    return { ok: false, error: "not_found" }
  }
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, booking.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function claimBusiness(
  slug: string
): Promise<ActionResult<{ businessId: string }>> {
  const session = await requireOwner()
  const result = await claimBusinessForUser(session.userId, slug)
  if (!result.ok) {
    return result
  }
  revalidateBusiness(slug)
  return result
}

const SUGGEST_SYSTEM_MESSAGE =
  "You suggest the bookable services for a local business's booking page. Return up to 8 common services this kind of business offers, each with a short name (max 60 characters), an optional one-line description (max 120 characters) and a typical length in minutes. Never include prices. Never repeat a service the business already has."

function languageLine(language: PageLanguage): string {
  return language === "es"
    ? "Write in Spanish (Latin American, informal tú)."
    : "Write in English."
}

function snapDuration(minutes: number): number {
  let best: number = BOOKING_RULES.serviceMinutes[0]
  for (const value of BOOKING_RULES.serviceMinutes) {
    if (Math.abs(value - minutes) < Math.abs(best - minutes)) {
      best = value
    }
  }
  return best
}

function mapSuggestions(
  raw: unknown,
  existingNames: string[]
): ServiceSuggestion[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()))
  const suggestions: ServiceSuggestion[] = []
  for (const item of raw) {
    if (suggestions.length >= 8) {
      break
    }
    if (!item || typeof item !== "object") {
      continue
    }
    const candidate = item as {
      name?: unknown
      description?: unknown
      durationMinutes?: unknown
    }
    if (typeof candidate.name !== "string") {
      continue
    }
    const name = candidate.name.trim()
    if (
      name.length === 0 ||
      name.length > BOOKING_RULES.maxServiceName ||
      taken.has(name.toLowerCase())
    ) {
      continue
    }
    taken.add(name.toLowerCase())
    const duration = Number(candidate.durationMinutes)
    if (!Number.isFinite(duration)) {
      continue
    }
    const description =
      typeof candidate.description === "string"
        ? candidate.description.trim() || null
        : null
    suggestions.push({
      name,
      description:
        description !== null && description.length > 120
          ? description.slice(0, 120)
          : description,
      durationMinutes: snapDuration(duration),
    })
  }
  return suggestions
}

export async function suggestServices(
  businessId: string,
  language: PageLanguage
): Promise<ActionResult<{ services: ServiceSuggestion[] }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (!isMetaAiEnabled()) {
    return { ok: false, error: "ai_off" }
  }
  const client = getMetaAiClient()
  if (!client) {
    return { ok: false, error: "ai_off" }
  }
  const lang = isPageLanguage(language) ? language : "en"
  const existing = await db
    .select({ name: services.name })
    .from(services)
    .where(eq(services.businessId, owned.business.id))
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: `${SUGGEST_SYSTEM_MESSAGE} ${languageLine(lang)}`,
          },
          {
            role: "user",
            content: [
              `Business name: ${owned.business.name}`,
              owned.business.category
                ? `Category: ${owned.business.category}`
                : null,
              existing.length > 0
                ? `Existing services: ${existing.map((row) => row.name).join(", ")}`
                : null,
            ]
              .filter((line) => line !== null)
              .join("\n"),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "service_suggestions",
            schema: {
              type: "object",
              properties: {
                services: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      durationMinutes: { type: "integer" },
                    },
                    required: ["name", "durationMinutes"],
                  },
                },
              },
              required: ["services"],
            },
          },
        },
      },
      { timeout: 15_000 }
    )
    const content = completion.choices[0]?.message?.content
    if (!content) {
      return { ok: false, error: "failed" }
    }
    const parsed = JSON.parse(content) as { services?: unknown }
    const suggestions = mapSuggestions(
      parsed.services,
      existing.map((row) => row.name)
    )
    if (!suggestions) {
      return { ok: false, error: "failed" }
    }
    revalidateBusiness(owned.business.slug)
    return { ok: true, services: suggestions }
  } catch {
    return { ok: false, error: "failed" }
  }
}
