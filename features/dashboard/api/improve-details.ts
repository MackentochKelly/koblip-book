"use server"

import { BOOKING_RULES } from "@/lib/booking-rules"
import { getMetaAiClient, META_TEXT_MODEL } from "@/lib/meta-ai"
import type { ActionResult } from "../types"
import { isTidiedName } from "../utils/tidy-name"
import { ownedBusiness } from "./owned-business"

const SYSTEM_MESSAGE = `You polish a local business's booking page details. Answer with:
- name: the business's own name, cleaned. Fix ALL CAPS or all lowercase to normal capitals, unless the lowercase is clearly the brand's style. Drop symbols like ™ or ®, and any slogan or place name after a separator like | or -. Keep every word of the name itself, in order; never add, drop, change or translate one.
- about: the About text, as the business speaking to a new customer. Two short sentences, at most 280 characters, warm, friendly and plain English. Say what kind of place it is and where (only the neighbourhood or city), then invite people to book. Keep the good facts from the current About; use only the facts given. Never invent prices, years, awards, staff or claims. No emojis, no hashtags, no quotes.`

const SCHEMA = {
  type: "object",
  properties: { name: { type: "string" }, about: { type: "string" } },
  required: ["name", "about"],
} as const

const MAX_ABOUT = 400

// Muse's suggestion for the details form's name and About, from what is in
// the form now. Nothing is saved: the form shows it and the owner saves.
// The name is kept as typed unless Muse's version passes isTidiedName.
export async function improveDetails(
  businessId: string,
  input: { name: string; description: string | null }
): Promise<ActionResult<{ name: string; description: string }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const client = getMetaAiClient()
  if (!client) {
    return { ok: false, error: "ai_off" }
  }
  const name = typeof input?.name === "string" ? input.name.trim() : ""
  const about =
    typeof input?.description === "string" ? input.description.trim() : ""
  if (
    !name ||
    name.length > BOOKING_RULES.maxBusinessName ||
    about.length > BOOKING_RULES.maxBusinessDescription
  ) {
    return { ok: false, error: "invalid" }
  }
  const { business } = owned
  const facts = [
    `Name: ${name}`,
    `Category: ${business.category ?? "unknown"}`,
    `Address: ${business.address ?? "unknown"}`,
    `Current About: ${about || "none"}`,
  ].join("\n")
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TEXT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: facts },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "business_details", schema: SCHEMA },
        },
      },
      { timeout: 20_000 }
    )
    const parsed = JSON.parse(
      completion.choices[0]?.message?.content ?? "{}"
    ) as { name?: unknown; about?: unknown }
    const tidied = typeof parsed.name === "string" ? parsed.name.trim() : ""
    const written = typeof parsed.about === "string" ? parsed.about.trim() : ""
    if (!written || written.length > MAX_ABOUT) {
      return { ok: false, error: "failed" }
    }
    return {
      ok: true,
      name: tidied && isTidiedName(name, tidied) ? tidied : name,
      description: written,
    }
  } catch {
    console.error("improveDetails: Meta AI request failed")
    return { ok: false, error: "failed" }
  }
}
