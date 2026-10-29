"use server"

import { and, eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { getMetaAiClient, isMetaAiEnabled, META_TEXT_MODEL } from "@/lib/meta-ai"
import { isPageLanguage, type PageLanguage } from "@/lib/page-language"
import {
  addonGroups,
  addonOptions,
  serviceAddonGroups,
  services,
} from "@/lib/db/schema"
import type {
  ActionResult,
  AddonGroupInput,
  AddonGroupSuggestion,
  AddonOptionInput,
  AddonOptionSuggestion,
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
  await saveAll([
    db.insert(addonGroups).values({
      id: groupId,
      businessId: owned.business.id,
      name: normalized.name,
      prompt: normalized.prompt,
      minSelect: normalized.minSelect,
      maxSelect: normalized.maxSelect,
      position: existing.length,
    }),
    db.insert(addonOptions).values(
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
    ),
    ...(normalized.serviceIds.length > 0
      ? [
          db.insert(serviceAddonGroups).values(
            normalized.serviceIds.map((serviceId, index) => ({
              businessId: owned.business.id,
              serviceId,
              groupId,
              position: index,
            }))
          ),
        ]
      : []),
  ])
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
  await saveAll([
    db
      .update(addonGroups)
      .set({
        name: normalized.name,
        prompt: normalized.prompt,
        minSelect: normalized.minSelect,
        maxSelect: normalized.maxSelect,
      })
      .where(eq(addonGroups.id, group.id)),
    ...normalized.options.map((option, index) =>
      option.id !== null
        ? db
            .update(addonOptions)
            .set({
              name: option.name,
              description: option.description,
              priceMinor: option.priceMinor,
              durationMinutes: option.durationMinutes,
              position: index,
            })
            .where(eq(addonOptions.id, option.id))
        : db.insert(addonOptions).values({
            id: crypto.randomUUID(),
            businessId: owned.business.id,
            groupId: group.id,
            name: option.name,
            description: option.description,
            priceMinor: option.priceMinor,
            durationMinutes: option.durationMinutes,
            position: index,
          })
    ),
    ...currentOptions
      .filter((row) => !seen.has(row.id))
      .map((row) => db.delete(addonOptions).where(eq(addonOptions.id, row.id))),
    db
      .delete(serviceAddonGroups)
      .where(eq(serviceAddonGroups.groupId, group.id)),
    ...(normalized.serviceIds.length > 0
      ? [
          db.insert(serviceAddonGroups).values(
            normalized.serviceIds.map((serviceId, index) => ({
              businessId: owned.business.id,
              serviceId,
              groupId: group.id,
              position: index,
            }))
          ),
        ]
      : []),
  ])
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
  await db.delete(addonGroups).where(eq(addonGroups.id, group.id))
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
  await saveAll(
    groupIds.map((id, position) =>
      db.update(addonGroups).set({ position }).where(eq(addonGroups.id, id))
    )
  )
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

const SUGGEST_ADDON_SYSTEM_MESSAGE =
  "You suggest add-on groups (extras) for a local business's booking page. Return up to 4 groups this kind of business usually offers with its services. Each group has a short name (max 60 characters), a short question shown to the customer (max 100 characters, e.g. 'Add anything?'), how many options the customer must pick (minSelect, usually 0) and may pick (maxSelect, or null for any), the ids of the business's services it fits (only ids from the list given), and 2 to 6 options. Each option has a short name (max 60 characters), an optional one-line description (max 120 characters) and the extra minutes it adds. Never include prices. Never repeat a group the business already has."

function languageLine(language: PageLanguage): string {
  return language === "es"
    ? "Write in Spanish (Latin American, informal tú)."
    : "Write in English."
}

function snapAddonMinutes(minutes: number): number {
  let best: number = BOOKING_RULES.addonMinutes[0]
  for (const value of BOOKING_RULES.addonMinutes) {
    if (Math.abs(value - minutes) < Math.abs(best - minutes)) {
      best = value
    }
  }
  return best
}

function mapAddonSuggestions(
  raw: unknown,
  existingNames: string[],
  serviceIds: Set<string>
): AddonGroupSuggestion[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()))
  const groups: AddonGroupSuggestion[] = []
  for (const item of raw) {
    if (groups.length >= 4) {
      break
    }
    if (!item || typeof item !== "object") {
      continue
    }
    const candidate = item as {
      name?: unknown
      prompt?: unknown
      minSelect?: unknown
      maxSelect?: unknown
      serviceIds?: unknown
      options?: unknown
    }
    if (typeof candidate.name !== "string") {
      continue
    }
    const name = candidate.name.trim()
    if (
      name.length === 0 ||
      name.length > BOOKING_RULES.maxAddonName ||
      taken.has(name.toLowerCase())
    ) {
      continue
    }
    if (typeof candidate.prompt !== "string") {
      continue
    }
    const prompt = candidate.prompt.trim()
    if (
      prompt.length === 0 ||
      prompt.length > BOOKING_RULES.maxAddonPrompt
    ) {
      continue
    }
    if (!Array.isArray(candidate.options)) {
      continue
    }
    const seen = new Set<string>()
    const options: AddonOptionSuggestion[] = []
    for (const rawOption of candidate.options) {
      if (options.length >= BOOKING_RULES.maxAddonOptions) {
        break
      }
      if (!rawOption || typeof rawOption !== "object") {
        continue
      }
      const optionCandidate = rawOption as {
        name?: unknown
        description?: unknown
        durationMinutes?: unknown
      }
      if (typeof optionCandidate.name !== "string") {
        continue
      }
      const optionName = optionCandidate.name.trim()
      if (
        optionName.length === 0 ||
        optionName.length > BOOKING_RULES.maxAddonName ||
        seen.has(optionName.toLowerCase())
      ) {
        continue
      }
      seen.add(optionName.toLowerCase())
      const duration = Number(optionCandidate.durationMinutes)
      if (!Number.isFinite(duration)) {
        continue
      }
      const description =
        typeof optionCandidate.description === "string"
          ? optionCandidate.description
              .trim()
              .slice(0, BOOKING_RULES.maxAddonDescription) || null
          : null
      options.push({
        name: optionName,
        description,
        durationMinutes: snapAddonMinutes(duration),
      })
    }
    if (options.length < 1) {
      continue
    }
    const ids: string[] = []
    if (Array.isArray(candidate.serviceIds)) {
      for (const id of candidate.serviceIds) {
        if (
          typeof id === "string" &&
          serviceIds.has(id) &&
          !ids.includes(id)
        ) {
          ids.push(id)
        }
      }
    }
    const minValue = Number(candidate.minSelect)
    const minSelect = Number.isFinite(minValue)
      ? Math.min(Math.max(0, Math.floor(minValue)), options.length)
      : 0
    let maxSelect: number | null = null
    if (candidate.maxSelect !== null && candidate.maxSelect !== undefined) {
      const maxValue = Number(candidate.maxSelect)
      if (Number.isFinite(maxValue)) {
        maxSelect = Math.min(
          Math.max(Math.floor(maxValue), Math.max(1, minSelect)),
          options.length
        )
      }
    }
    taken.add(name.toLowerCase())
    groups.push({ name, prompt, minSelect, maxSelect, serviceIds: ids, options })
  }
  return groups
}

// Suggests add-on groups but saves nothing. The UI calls createAddonGroup
// for each group the owner ticks, with priceMinor: null on every option.
export async function suggestAddonGroups(
  businessId: string,
  language: PageLanguage
): Promise<ActionResult<{ groups: AddonGroupSuggestion[] }>> {
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
  const [serviceRows, groupRows] = await Promise.all([
    db
      .select({ id: services.id, name: services.name })
      .from(services)
      .where(eq(services.businessId, owned.business.id)),
    db
      .select({ name: addonGroups.name })
      .from(addonGroups)
      .where(eq(addonGroups.businessId, owned.business.id)),
  ])
  if (groupRows.length >= BOOKING_RULES.maxAddonGroups) {
    return { ok: true, groups: [] }
  }
  const lang = isPageLanguage(language) ? language : "en"
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: `${SUGGEST_ADDON_SYSTEM_MESSAGE} ${languageLine(lang)}`,
          },
          {
            role: "user",
            content: [
              `Business name: ${owned.business.name}`,
              owned.business.category
                ? `Category: ${owned.business.category}`
                : null,
              serviceRows.length > 0
                ? `Services:\n${serviceRows.map((row) => `${row.id}: ${row.name}`).join("\n")}`
                : null,
              groupRows.length > 0
                ? `Existing add-on groups: ${groupRows.map((row) => row.name).join(", ")}`
                : null,
            ]
              .filter((line) => line !== null)
              .join("\n"),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "addon_suggestions",
            schema: {
              type: "object",
              properties: {
                groups: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      prompt: { type: "string" },
                      minSelect: { type: "integer" },
                      maxSelect: { type: ["integer", "null"] },
                      serviceIds: {
                        type: "array",
                        items: { type: "string" },
                      },
                      options: {
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
                    required: [
                      "name",
                      "prompt",
                      "minSelect",
                      "serviceIds",
                      "options",
                    ],
                  },
                },
              },
              required: ["groups"],
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
    const parsed = JSON.parse(content) as { groups?: unknown }
    const groups = mapAddonSuggestions(
      parsed.groups,
      groupRows.map((row) => row.name),
      new Set(serviceRows.map((row) => row.id))
    )
    if (!groups) {
      return { ok: false, error: "failed" }
    }
    revalidateBusiness(owned.business.slug)
    return { ok: true, groups }
  } catch {
    return { ok: false, error: "failed" }
  }
}
