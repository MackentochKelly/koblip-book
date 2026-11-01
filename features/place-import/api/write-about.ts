import "server-only"
import { getMetaAiClient, META_TEXT_MODEL } from "@/lib/meta-ai"

export interface AboutFacts {
  name: string
  category?: string | null
  // Full formatted address; the model picks the city.
  address?: string | null
  openingDays?: string[]
  amenities?: string[]
  // Google's specific types in words ("hair care"); help name the category.
  placeTypes?: string[]
  website?: string | null
  // Google gave no useful category: Muse names one too.
  nameCategory?: boolean
}

export interface AboutWords {
  about: string
  // Only when asked (nameCategory) and the answer passes the check.
  category: string | null
}

const SYSTEM_MESSAGE =
  "You write the About text for a local business's booking page, as the business speaking to a new customer. Two short sentences, at most 280 characters, warm, friendly and plain English. Say what kind of place it is and where (name only the neighbourhood or city, never the street address or postal code), then invite people in or to book. Use only the facts given. Never invent prices, years, awards, staff, products or claims. Do not list the opening days. No emojis, no hashtags, no quotes."

const CATEGORY_MESSAGE =
  'Also name what kind of business it is in "category": 1 to 3 words in sentence case, the way Google Maps names a business type (for example "Photography studio", "Dog groomer", "Nail salon"). Never a word that fits any business, like Services, Store or Business. The About says the same kind of place.'

const ABOUT_SCHEMA_NAME = "business_about"

const ABOUT_JSON_SCHEMA = {
  type: "object",
  properties: { about: { type: "string" } },
  required: ["about"],
} as const

const ABOUT_AND_CATEGORY_JSON_SCHEMA = {
  type: "object",
  properties: { about: { type: "string" }, category: { type: "string" } },
  required: ["about", "category"],
} as const

const MAX_ABOUT_LENGTH = 400

// A category is a short name: letters, spaces and & - ' only, 1 to 3
// words, never a catch-all.
const MAX_CATEGORY_LENGTH = 40
const CATEGORY_PATTERN = /^\p{L}[\p{L}&' -]*$/u
const CATCH_ALL_CATEGORIES = new Set([
  "business",
  "local business",
  "service",
  "services",
  "shop",
  "store",
])

function checkCategory(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const category = value.trim().replace(/\s+/g, " ")
  if (
    !category ||
    category.length > MAX_CATEGORY_LENGTH ||
    !CATEGORY_PATTERN.test(category) ||
    category.split(" ").length > 3 ||
    CATCH_ALL_CATEGORIES.has(category.toLowerCase())
  ) {
    return null
  }
  return category[0].toUpperCase() + category.slice(1)
}

function websiteHost(website: string): string | null {
  try {
    return new URL(website).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function userMessage(facts: AboutFacts): string {
  const lines = [`Business name: ${facts.name}`]
  if (facts.category) {
    lines.push(`Category: ${facts.category}`)
  }
  if (facts.address) {
    lines.push(`Address: ${facts.address}`)
  }
  if (facts.openingDays && facts.openingDays.length > 0) {
    lines.push(`Opening days: ${facts.openingDays.join(", ")}`)
  }
  if (facts.amenities && facts.amenities.length > 0) {
    lines.push(`Amenities: ${facts.amenities.join(", ")}`)
  }
  if (facts.placeTypes && facts.placeTypes.length > 0) {
    lines.push(`Google types: ${facts.placeTypes.join(", ")}`)
  }
  const host = facts.website ? websiteHost(facts.website) : null
  if (host) {
    lines.push(`Website: ${host}`)
  }
  return lines.join("\n")
}

// Writes the About text from our own business facts only. Never Google
// reviews or review text. With nameCategory, the same answer also names
// the kind of business. Returns null when the AI is off, the About is
// unusable, or anything fails; a category that fails its check is null.
export async function writeAbout(
  facts: AboutFacts
): Promise<AboutWords | null> {
  const client = getMetaAiClient()
  if (!client) {
    return null
  }
  const nameCategory = facts.nameCategory === true
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: nameCategory
              ? `${SYSTEM_MESSAGE}\n${CATEGORY_MESSAGE}`
              : SYSTEM_MESSAGE,
          },
          { role: "user", content: userMessage(facts) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: ABOUT_SCHEMA_NAME,
            schema: nameCategory
              ? ABOUT_AND_CATEGORY_JSON_SCHEMA
              : ABOUT_JSON_SCHEMA,
          },
        },
      },
      { timeout: 15_000 }
    )
    const content = completion.choices[0]?.message?.content
    if (!content) {
      return null
    }
    const parsed = JSON.parse(content) as {
      about?: unknown
      category?: unknown
    }
    if (typeof parsed.about !== "string") {
      return null
    }
    const about = parsed.about.trim()
    if (!about || about.length > MAX_ABOUT_LENGTH) {
      return null
    }
    return {
      about,
      category: nameCategory ? checkCategory(parsed.category) : null,
    }
  } catch {
    console.error("writeAbout: Meta AI request failed")
    return null
  }
}
