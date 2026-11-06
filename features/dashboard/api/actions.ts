"use server"

import { and, asc, eq, gte } from "drizzle-orm"
import {
  BOOKING_RULES,
  type CancelReason,
  isCancelReason,
  PHONE_PATTERN,
} from "@/lib/booking-rules"
import { hasFeature } from "@/lib/plan-access"
import { requireAccount } from "@/lib/dal"
import { db } from "@/lib/db"
import { isGoogleEventColor } from "@/lib/google-calendar-colors"
import { requestGoogleSync } from "@/lib/google-calendar-sync"
import { saveAll } from "@/lib/db/save-all"
import { clientNotification } from "@/lib/in-app-notifications"
import {
  bookings,
  businessHours,
  businesses,
  serviceCategories,
  services,
  teamMembers,
  teamMemberHours,
} from "@/lib/db/schema"
import {
  getMetaAiClient,
  isMetaAiEnabled,
  META_TEXT_MODEL,
  writingLanguageLine,
} from "@/lib/meta-ai"
import { isPageLanguage, type PageLanguage } from "@/lib/page-language"
import type {
  ActionResult,
  BusinessDetailsInput,
  HoursRow,
  ServiceInput,
  ServiceSuggestion,
} from "../types"
import { claimBusinessForUser } from "./claim"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { translateBusinessSoon } from "@/lib/translations/business-texts"
import { ownedBusiness } from "./owned-business"

import { validHours } from "@/lib/hours-rules"
import { randomStartingCounts } from "@/lib/team-rules"

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
  // Any ISO 4217 currency Intl knows. Prices keep their numbers; nothing
  // is converted, and past bookings keep their own currency.
  if (
    input.currency !== undefined &&
    !Intl.supportedValuesOf("currency").includes(input.currency)
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
      ...(input.currency !== undefined && { currency: input.currency }),
      detailsConfirmedAt: Date.now(),
    })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  translateBusinessSoon(owned.business.id)
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
  if (!validHours(rows)) return invalid()
  await saveAll([
    db
      .delete(businessHours)
      .where(eq(businessHours.businessId, owned.business.id)),
    ...(rows.length > 0
      ? [
          db.insert(businessHours).values(
            rows.map((row) => ({
              businessId: owned.business.id,
              weekday: row.weekday,
              opensAt: row.opensAt,
              closesAt: row.closesAt,
            }))
          ),
        ]
      : []),
    db
      .update(businesses)
      .set({ detailsConfirmedAt: Date.now() })
      .where(eq(businesses.id, owned.business.id)),
  ])
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
  if (
    input.calendarColor !== undefined &&
    input.calendarColor !== null &&
    !isGoogleEventColor(input.calendarColor)
  ) {
    return null
  }
  return {
    name,
    description,
    durationMinutes: input.durationMinutes,
    priceMinor: input.priceMinor,
    ...(input.calendarColor !== undefined ? { calendarColor: input.calendarColor } : {}),
  }
}

// Whether a service may go in this category: null (Other) or one of the
// business's own categories.
async function isOwnCategory(
  businessId: string,
  categoryId: string | null | undefined
): Promise<boolean> {
  if (categoryId === undefined || categoryId === null) {
    return true
  }
  if (typeof categoryId !== "string") {
    return false
  }
  const [category] = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.businessId, businessId)
      )
    )
    .limit(1)
  return Boolean(category)
}

// After every other service: last in its category, wherever that is.
function nextPosition(rows: { position: number }[]): number {
  return rows.reduce((last, row) => Math.max(last, row.position + 1), 0)
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
  if (!(await isOwnCategory(owned.business.id, input.categoryId))) {
    return invalid()
  }
  const existing = await db
    .select({ id: services.id, position: services.position })
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
    categoryId: input.categoryId ?? null,
    position: nextPosition(existing),
  })
  revalidateBusiness(owned.business.slug)
  translateBusinessSoon(owned.business.id)
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
    .select({ id: services.id, categoryId: services.categoryId })
    .from(services)
    .where(
      and(eq(services.id, serviceId), eq(services.businessId, owned.business.id))
    )
    .limit(1)
  if (!service) {
    return { ok: false, error: "not_found" }
  }
  if (!(await isOwnCategory(owned.business.id, input.categoryId))) {
    return invalid()
  }
  // A service moved to another category goes last in it.
  const moved =
    input.categoryId !== undefined && input.categoryId !== service.categoryId
  const position = moved
    ? nextPosition(
        await db
          .select({ position: services.position })
          .from(services)
          .where(eq(services.businessId, owned.business.id))
      )
    : undefined
  await db
    .update(services)
    .set({
      ...normalized,
      ...(moved ? { categoryId: input.categoryId ?? null, position } : {}),
    })
    .where(eq(services.id, service.id))
  revalidateBusiness(owned.business.slug)
  translateBusinessSoon(owned.business.id)
  // Its bookings' events carry its colour (G7).
  requestGoogleSync(owned.business.id)
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
  translateBusinessSoon(owned.business.id)
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
  await saveAll(
    ids.map((id, position) =>
      db.update(services).set({ position }).where(eq(services.id, id))
    )
  )
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
    ...randomStartingCounts(),
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
  await saveAll([
    db.delete(teamMemberHours).where(and(eq(teamMemberHours.businessId, businessId), eq(teamMemberHours.teamMemberId, member.id))),
    db.delete(teamMembers).where(eq(teamMembers.id, member.id)),
  ])
  revalidateBusiness(owned.business.slug)
  translateBusinessSoon(owned.business.id)
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
  await saveAll(
    ids.map((id, position) =>
      db.update(teamMembers).set({ position }).where(eq(teamMembers.id, id))
    )
  )
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

export async function cancelBooking(
  businessId: string,
  bookingId: string,
  reason: CancelReason | null = null
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (reason !== null && !isCancelReason(reason)) {
    return invalid()
  }
  const [booking] = await db
    .select({
      id: bookings.id,
      businessId: bookings.businessId,
      moves: bookings.moves,
      serviceName: bookings.serviceName,
      startAt: bookings.startAt,
      customerUserId: bookings.customerUserId,
      customerKey: bookings.customerKey,
    })
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
  // The client's bell hears of it, saved with the cancel.
  await saveAll([
    db
      .update(bookings)
      .set({ status: "cancelled", cancelReason: reason })
      .where(eq(bookings.id, booking.id)),
    ...(await clientNotification(booking, "clientCancelled")),
  ])
  revalidateBusiness(owned.business.slug)
  // Google Calendar hears of it now.
  requestGoogleSync(owned.business.id)
  return { ok: true }
}

export async function claimBusiness(
  slug: string
): Promise<ActionResult<{ businessId: string }>> {
  // Only a real account claims a business, never a demo guest.
  const session = await requireAccount()
  const result = await claimBusinessForUser(session.userId, slug)
  if (!result.ok) {
    return result
  }
  revalidateBusiness(slug)
  return result
}

const SUGGEST_SYSTEM_MESSAGE =
  "You suggest the bookable services for a local business's booking page. Return up to 8 common services this kind of business offers, each with a short name (max 60 characters), an optional one-line description (max 120 characters), a typical length in minutes and a category: one of the business's existing service categories, written exactly as given, when one fits, else a short new one (1 to 3 plain words, like \"Haircuts\"), or empty when none is needed. Never include prices. Never repeat a service the business already has."

function snapDuration(minutes: number): number {
  let best: number = BOOKING_RULES.serviceMinutes[0]
  for (const value of BOOKING_RULES.serviceMinutes) {
    if (Math.abs(value - minutes) < Math.abs(best - minutes)) {
      best = value
    }
  }
  return best
}

// A suggestion's category: an existing one in its saved spelling when the
// names match whatever their capitals, else a new name that fits, else
// none (Other).
function suggestedCategory(
  value: unknown,
  categoryNames: string[]
): string | null {
  if (typeof value !== "string") {
    return null
  }
  const name = value.trim().replace(/\s+/g, " ")
  const existing = categoryNames.find(
    (category) => category.toLocaleLowerCase() === name.toLocaleLowerCase()
  )
  if (existing) {
    return existing
  }
  return name.length > 0 && name.length <= BOOKING_RULES.maxServiceCategoryName
    ? name
    : null
}

function mapSuggestions(
  raw: unknown,
  existingNames: string[],
  categoryNames: string[]
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
      category?: unknown
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
      category: suggestedCategory(candidate.category, categoryNames),
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
  if (!(await hasFeature(businessId, "aiWriting"))) {
    return { ok: false, error: "locked" }
  }
  if (!isMetaAiEnabled()) {
    return { ok: false, error: "ai_off" }
  }
  const client = getMetaAiClient()
  if (!client) {
    return { ok: false, error: "ai_off" }
  }
  const lang = isPageLanguage(language) ? language : "en"
  const [existing, categories] = await Promise.all([
    db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.businessId, owned.business.id)),
    db
      .select({ name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.businessId, owned.business.id))
      .orderBy(asc(serviceCategories.position)),
  ])
  const categoryNames = categories.map((row) => row.name)
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: `${SUGGEST_SYSTEM_MESSAGE} ${writingLanguageLine(lang)}`,
          },
          {
            role: "user",
            content: [
              `Business name: ${owned.business.name}`,
              // The Google category, named so the model never takes it for
              // a service category.
              owned.business.category
                ? `Business type: ${owned.business.category}`
                : null,
              existing.length > 0
                ? `Existing services: ${existing.map((row) => row.name).join(", ")}`
                : null,
              categoryNames.length > 0
                ? `Existing service categories: ${categoryNames.join(", ")}`
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
                      category: { type: "string" },
                    },
                    required: ["name", "durationMinutes", "category"],
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
      existing.map((row) => row.name),
      categoryNames
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
