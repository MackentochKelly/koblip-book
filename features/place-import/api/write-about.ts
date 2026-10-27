import "server-only"
import { getMetaAiClient, META_TEXT_MODEL } from "@/lib/meta-ai"

export interface AboutFacts {
  name: string
  category?: string | null
  // Full formatted address; the model picks the city.
  address?: string | null
  openingDays?: string[]
  amenities?: string[]
}

const SYSTEM_MESSAGE =
  "You write the About text for a local business's booking page, as the business speaking to a new customer. Two short sentences, at most 280 characters, warm, friendly and plain English. Say what kind of place it is and where (name only the neighbourhood or city, never the street address or postal code), then invite people in or to book. Use only the facts given. Never invent prices, years, awards, staff, products or claims. Do not list the opening days. No emojis, no hashtags, no quotes."

const ABOUT_SCHEMA_NAME = "business_about"

const ABOUT_JSON_SCHEMA = {
  type: "object",
  properties: { about: { type: "string" } },
  required: ["about"],
} as const

const MAX_ABOUT_LENGTH = 400

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
  return lines.join("\n")
}

// Writes the About text from our own business facts only. Never Google
// reviews or review text. Returns null when the AI is off, the answer is
// unusable, or anything fails.
export async function writeAbout(facts: AboutFacts): Promise<string | null> {
  const client = getMetaAiClient()
  if (!client) {
    return null
  }
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TEXT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: userMessage(facts) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: ABOUT_SCHEMA_NAME,
            schema: ABOUT_JSON_SCHEMA,
          },
        },
      },
      { timeout: 15_000 }
    )
    const content = completion.choices[0]?.message?.content
    if (!content) {
      return null
    }
    const parsed = JSON.parse(content) as { about?: unknown }
    if (typeof parsed.about !== "string") {
      return null
    }
    const about = parsed.about.trim()
    if (!about || about.length > MAX_ABOUT_LENGTH) {
      return null
    }
    return about
  } catch {
    console.error("writeAbout: Meta AI request failed")
    return null
  }
}
