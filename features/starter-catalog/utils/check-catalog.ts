import { BOOKING_RULES } from "@/lib/booking-rules"
import { STARTER_CATALOG_RULES as RULES } from "@/lib/starter-catalog-rules"
import type { DraftCatalog, DraftItem, DraftService } from "../types"

export type CheckedCatalog = Pick<DraftCatalog, "team"> & {
  // `category`: the service's category, spelled the same for every service
  // in it; null for all when the catalog keeps no categories.
  services: Array<DraftItem & { priceMinor: number; category: string | null }>
  extras: {
    name: string
    prompt: string
    options: Array<DraftItem & { priceMinor: number }>
  }
}

export type CatalogCheck =
  | { ok: true; catalog: CheckedCatalog }
  | { ok: false; problems: string[] }

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

// The allowed length closest to what was asked (ties take the shorter).
function nearest(minutes: number, allowed: readonly number[]): number {
  return allowed.reduce((best, option) =>
    Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best
  )
}

function checkItems(
  label: string,
  value: unknown,
  limits: {
    min: number
    max: number
    maxName: number
    maxDescription: number
    minutes: readonly number[]
  },
  problems: string[]
): Array<DraftItem & { priceMinor: number }> {
  if (!Array.isArray(value)) {
    problems.push(`${label} must be a list.`)
    return []
  }
  if (value.length < limits.min || value.length > limits.max) {
    problems.push(`Give ${limits.min} to ${limits.max} ${label}, not ${value.length}.`)
  }
  const names = new Set<string>()
  return value.slice(0, limits.max).map((raw: Partial<DraftItem>, index) => {
    const name = text(raw?.name)
    const description = text(raw?.description)
    const at = `${label} ${index + 1}`
    if (!name || name.length > limits.maxName) {
      problems.push(`${at}: name must be 1 to ${limits.maxName} characters.`)
    }
    if (names.has(name.toLowerCase())) {
      problems.push(`${at}: "${name}" is listed twice.`)
    }
    names.add(name.toLowerCase())
    if (description.length > limits.maxDescription) {
      problems.push(`${at}: description must be at most ${limits.maxDescription} characters.`)
    }
    const minutes = Number(raw?.durationMinutes)
    if (!Number.isFinite(minutes) || minutes < 0) {
      problems.push(`${at}: durationMinutes must be a number of minutes.`)
    }
    const price = Number(raw?.price)
    const priceMinor = Math.round(price * 100)
    if (!Number.isFinite(price) || price <= 0 || priceMinor > BOOKING_RULES.maxPriceMinor) {
      problems.push(`${at}: price must be a positive amount in the local currency.`)
    }
    return {
      name,
      description,
      durationMinutes: nearest(Number.isFinite(minutes) ? minutes : 0, limits.minutes),
      price,
      priceMinor,
    }
  })
}

// A category name as the owner's own category actions save it: trimmed,
// single spaces, 1 to maxServiceCategoryName long. Anything else is none.
function categoryName(value: unknown): string | null {
  const name = text(value).replace(/\s+/g, " ")
  return name.length > 0 && name.length <= BOOKING_RULES.maxServiceCategoryName
    ? name
    : null
}

// Each checked service's category. Kept only when the services have
// RULES.minCategories to RULES.maxCategories different ones (whatever
// their capitals, each spelled as first seen); otherwise none at all, so
// the page stays the flat list it is without categories. Never a problem
// for the model: a draft is never sent back for its categories.
function checkCategories(raw: unknown, count: number): Array<string | null> {
  const items: unknown[] = Array.isArray(raw) ? raw.slice(0, count) : []
  const spellings = new Map<string, string>()
  const names = items.map((item) => {
    const name = categoryName((item as Partial<DraftService> | null)?.category)
    if (!name) {
      return null
    }
    const key = name.toLocaleLowerCase()
    const known = spellings.get(key)
    if (known) {
      return known
    }
    spellings.set(key, name)
    return name
  })
  const keep =
    spellings.size >= RULES.minCategories &&
    spellings.size <= RULES.maxCategories
  return Array.from({ length: count }, (_, index) =>
    keep ? (names[index] ?? null) : null
  )
}

// Fixed-rule check of Meta AI's catalog before anything is saved: right
// shape, counts and lengths, real prices, lengths the booking page offers
// (snapped to the nearest one), no repeats, and no extra that repeats a
// service; then the services' categories, which are never a problem.
// Problems are written for the model, so they can be sent back.
export function checkCatalog(draft: unknown): CatalogCheck {
  const problems: string[] = []
  const value = (draft ?? {}) as Partial<DraftCatalog>

  const services = checkItems("services", value.services, {
    min: RULES.minServices,
    max: RULES.maxServices,
    maxName: BOOKING_RULES.maxServiceName,
    maxDescription: BOOKING_RULES.maxServiceDescription,
    minutes: BOOKING_RULES.serviceMinutes.filter((minutes) => minutes > 0),
  }, problems)

  const groupName = text(value.extras?.name)
  if (!groupName || groupName.length > BOOKING_RULES.maxAddonName) {
    problems.push(`extras.name must be 1 to ${BOOKING_RULES.maxAddonName} characters.`)
  }
  const prompt = text(value.extras?.prompt)
  if (!prompt || prompt.length > BOOKING_RULES.maxAddonPrompt) {
    problems.push(`extras.prompt must be 1 to ${BOOKING_RULES.maxAddonPrompt} characters.`)
  }
  const options = checkItems("extras", value.extras?.options, {
    min: RULES.minExtras,
    max: RULES.maxExtras,
    maxName: BOOKING_RULES.maxAddonName,
    maxDescription: BOOKING_RULES.maxAddonDescription,
    minutes: BOOKING_RULES.addonMinutes,
  }, problems)
  const serviceNames = new Set(services.map((item) => item.name.toLowerCase()))
  for (const option of options) {
    if (serviceNames.has(option.name.toLowerCase())) {
      problems.push(`Extra "${option.name}" is also a service; extras must be different.`)
    }
  }

  const role = text(value.team?.role)
  if (!role || role.length > BOOKING_RULES.maxTeamDescription) {
    problems.push("team.role must be one short job title.")
  }
  const members = Array.isArray(value.team?.members) ? value.team.members : []
  if (members.length !== RULES.teamSize) {
    problems.push(`Give exactly ${RULES.teamSize} team members, not ${members.length}.`)
  }
  const team = members.slice(0, RULES.teamSize).map((raw, index) => {
    const name = text(raw?.name)
    const description = text(raw?.description)
    if (!name || name.length > BOOKING_RULES.maxTeamName) {
      problems.push(`team member ${index + 1}: name must be 1 to ${BOOKING_RULES.maxTeamName} characters.`)
    }
    if (description.length > BOOKING_RULES.maxTeamDescription) {
      problems.push(`team member ${index + 1}: description must be at most ${BOOKING_RULES.maxTeamDescription} characters.`)
    }
    return { name, description }
  })

  if (problems.length > 0) {
    return { ok: false, problems }
  }
  const categories = checkCategories(value.services, services.length)
  return {
    ok: true,
    catalog: {
      services: services.map((service, index) => ({
        ...service,
        category: categories[index],
      })),
      extras: { name: groupName, prompt, options },
      team: { role, members: team },
    },
  }
}
