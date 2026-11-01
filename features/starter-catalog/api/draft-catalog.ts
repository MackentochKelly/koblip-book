import "server-only"
import type OpenAI from "openai"
import { getMetaAiClient, META_TEXT_MODEL } from "@/lib/meta-ai"
import { STARTER_CATALOG_RULES as RULES } from "@/lib/starter-catalog-rules"
import { checkCatalog, type CheckedCatalog } from "../utils/check-catalog"

export interface BusinessFacts {
  name: string
  category: string | null
  address: string | null
  currency: string
  description: string | null
}

const SYSTEM_MESSAGE = `You set up the booking page of a real local business, from its Google Maps details. Write what this kind of business really offers, in plain English, the way the owner would.
- services: ${RULES.minServices} to ${RULES.maxServices} of its most booked services, most popular first. Short names (2 to 4 words), one plain sentence each.
- extras: ${RULES.minExtras} to ${RULES.maxExtras} add-ons a customer can add to any service, never a copy of a service, plus the group's short name (1 to 3 words) and a short question asked over them.
- price: a typical price in the given currency's main unit for this kind of place in its city, as a plain number. Round it the way local price lists do.
- durationMinutes: how long it really takes.
- team: the job title of one person who does these services (singular), and ${RULES.teamSize} team members: a common first name for the business's country and one short line about what they are good at. Mix genders.
No emojis, no claims, no awards, no business names in the items.`

const STRING = { type: "string" } as const
const ITEM = {
  type: "object",
  properties: {
    name: STRING,
    description: STRING,
    durationMinutes: { type: "integer" },
    price: { type: "number" },
  },
  required: ["name", "description", "durationMinutes", "price"],
} as const

const CATALOG_SCHEMA = {
  type: "object",
  properties: {
    services: { type: "array", items: ITEM },
    extras: {
      type: "object",
      properties: {
        name: STRING,
        prompt: STRING,
        options: { type: "array", items: ITEM },
      },
      required: ["name", "prompt", "options"],
    },
    team: {
      type: "object",
      properties: {
        role: STRING,
        members: {
          type: "array",
          items: {
            type: "object",
            properties: { name: STRING, description: STRING },
            required: ["name", "description"],
          },
        },
      },
      required: ["role", "members"],
    },
  },
  required: ["services", "extras", "team"],
} as const

function factsMessage(facts: BusinessFacts): string {
  return [
    `Business name: ${facts.name}`,
    `Category: ${facts.category ?? "unknown"}`,
    `Address: ${facts.address ?? "unknown"}`,
    `Currency: ${facts.currency}`,
    facts.description ? `About: ${facts.description}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function parse(content: string | null | undefined): unknown {
  try {
    return content ? JSON.parse(content) : null
  } catch {
    return null
  }
}

// Asks Muse Spark for the catalog and checks it with fixed rules. A failed
// check goes back to the model with its reasons, up to RULES.attempts
// tries. Null when the AI is off, every try fails, or anything breaks.
export async function draftCatalog(
  facts: BusinessFacts
): Promise<CheckedCatalog | null> {
  const client = getMetaAiClient()
  if (!client) {
    return null
  }
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: factsMessage(facts) },
  ]
  try {
    for (let attempt = 1; attempt <= RULES.attempts; attempt++) {
      const completion = await client.chat.completions.create(
        {
          model: META_TEXT_MODEL,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: "starter_catalog", schema: CATALOG_SCHEMA },
          },
        },
        { timeout: RULES.textTimeoutMs }
      )
      const content = completion.choices[0]?.message?.content
      const check = checkCatalog(parse(content))
      if (check.ok) {
        return check.catalog
      }
      messages.push(
        { role: "assistant", content: content ?? "" },
        {
          role: "user",
          content: `Fix these and answer again with the whole catalog:\n- ${check.problems.join("\n- ")}`,
        }
      )
    }
    console.error("draftCatalog: no catalog passed the check")
    return null
  } catch {
    console.error("draftCatalog: Meta AI request failed")
    return null
  }
}
