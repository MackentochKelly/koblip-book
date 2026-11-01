import "server-only"
import type OpenAI from "openai"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { getMetaAiClient, META_TEXT_MODEL } from "@/lib/meta-ai"
import { POLICY_RULES as RULES } from "@/lib/policy-rules"
import { checkPolicies, type DraftPolicies } from "../utils/check-policies"

export interface PolicyFacts {
  name: string
  category: string | null
  address: string | null
  phone: string | null
}

// What the booking page really does, so a policy never promises more.
const HOW_BOOKING_WORKS = `How booking works on this page (true for every business, never say otherwise):
- Customers book online for free; nothing is paid online. Payment happens at the business.
- A booking needs at least ${BOOKING_RULES.minimumNoticeMinutes} minutes' notice.
- The booking form asks for the customer's name and phone number, an optional note, and whether they agree to booking messages on WhatsApp.
- The business uses these details to keep the booking and send confirmations and reminders. Bookings are kept on Koblip Book, the booking service the business uses.
- To cancel or change a booking, the customer contacts the business.`

const SYSTEM_MESSAGE = `You write three short policies for a real local business's booking page, in plain, friendly English, as the business speaking ("we", "you"). Fit them to this kind of business.
- booking: the booking and cancellation policy: how much notice to give when cancelling or changing (pick what is usual for this kind of business), arriving late, missed appointments, and anything customers should know before their visit.
- terms: the terms of service for booking with the business: what a booking is, changes the business may need to make, being respectful, health and safety where it fits, and that local law applies.
- privacy: how the business uses customers' details: what is collected, why, who sees it, how long it is kept, and how to ask to see or delete it by contacting the business.
Each is ${RULES.minDraftLength} to ${Math.round(RULES.maxLength * 0.6)} characters, short paragraphs separated by a blank line, no headings, no list symbols, no Markdown, no blanks to fill in. Use only the facts given; never invent prices, fees, deposits, refunds, emails, websites, laws or numbers.

${HOW_BOOKING_WORKS}`

const SCHEMA = {
  type: "object",
  properties: {
    booking: { type: "string" },
    terms: { type: "string" },
    privacy: { type: "string" },
  },
  required: ["booking", "terms", "privacy"],
} as const

function factsMessage(facts: PolicyFacts): string {
  return [
    `Business name: ${facts.name}`,
    `Category: ${facts.category ?? "unknown"}`,
    `Address: ${facts.address ?? "unknown"}`,
    facts.phone ? `Phone: ${facts.phone}` : "Phone: none listed",
  ].join("\n")
}

function parse(content: string | null | undefined): unknown {
  try {
    return content ? JSON.parse(content) : null
  } catch {
    return null
  }
}

// Asks Muse Spark for the business's policies and checks them with fixed
// rules; a failed check goes back with its reasons, up to RULES.attempts
// tries. Null when the AI is off, every try fails, or anything breaks.
export async function draftPolicies(
  facts: PolicyFacts
): Promise<DraftPolicies | null> {
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
            json_schema: { name: "business_policies", schema: SCHEMA },
          },
        },
        { timeout: RULES.textTimeoutMs }
      )
      const content = completion.choices[0]?.message?.content
      const check = checkPolicies(parse(content))
      if (check.ok) {
        return check.policies
      }
      messages.push(
        { role: "assistant", content: content ?? "" },
        {
          role: "user",
          content: `Fix these and answer again with all three:\n- ${check.problems.join("\n- ")}`,
        }
      )
    }
    console.error("draftPolicies: no policies passed the check")
    return null
  } catch {
    console.error("draftPolicies: Meta AI request failed")
    return null
  }
}
