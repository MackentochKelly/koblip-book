import "server-only"
import type OpenAI from "openai"
import { getMetaAiClient, META_TEXT_MODEL } from "@/lib/meta-ai"
import type { PolicyPaymentState } from "@/lib/payment-rules"
import { POLICY_RULES as RULES } from "@/lib/policy-rules"
import {
  checkPolicyRewrite,
  type CurrentPolicies,
  type PolicyRewrite,
} from "../utils/check-policy-rewrite"
import { payingFact } from "../utils/paying-fact"

// A business changed how customers can pay, so what its policies say about
// paying is out of date. Everything else in them is the owner's and stays.
function systemMessage(payment: PolicyPaymentState): string {
  return `A local business changed how its customers can pay. You bring its booking page's policies and key points up to date.
How paying works at this business now (never say otherwise):
- ${payingFact(payment)}
Rules:
- Change only what is said about how, when or where the customer pays, so it is true now. Keep every other sentence word for word.
- Keep each text's language, voice and paragraphs. A key point's title changes only when it is about paying and no longer true (at most ${RULES.maxPointTitle} characters; its text at most ${RULES.maxPointBody}).
- Never invent prices, fees, deposits, refunds or numbers. No Markdown, no blanks to fill in.
- Answer with only the policies and points you changed, each whole, with its id. Leave out the ones that say nothing about paying or are already true.`
}

const SCHEMA = {
  type: "object",
  properties: {
    policies: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, body: { type: "string" } },
        required: ["id", "body"],
      },
    },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["id", "title", "body"],
      },
    },
  },
  required: ["policies", "points"],
} as const

function parse(content: string | null | undefined): unknown {
  try {
    return content ? JSON.parse(content) : null
  } catch {
    return null
  }
}

// Asks Muse Spark for the texts that must change and checks them with
// fixed rules; a failed check goes back with its reasons, up to
// RULES.attempts tries. Null when the AI is off, every try fails, or
// anything breaks.
export async function rewritePolicies(
  current: CurrentPolicies,
  payment: PolicyPaymentState
): Promise<PolicyRewrite | null> {
  const client = getMetaAiClient()
  if (!client) {
    return null
  }
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage(payment) },
    { role: "user", content: JSON.stringify(current) },
  ]
  try {
    for (let attempt = 1; attempt <= RULES.attempts; attempt++) {
      const completion = await client.chat.completions.create(
        {
          model: META_TEXT_MODEL,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: "policy_changes", schema: SCHEMA },
          },
        },
        { timeout: RULES.textTimeoutMs }
      )
      const content = completion.choices[0]?.message?.content
      const check = checkPolicyRewrite(parse(content), current)
      if (check.ok) {
        return check.rewrite
      }
      messages.push(
        { role: "assistant", content: content ?? "" },
        {
          role: "user",
          content: `Fix these and answer again with all of it:\n- ${check.problems.join("\n- ")}`,
        }
      )
    }
    console.error("rewritePolicies: no answer passed the check")
    return null
  } catch {
    console.error("rewritePolicies: Meta AI request failed")
    return null
  }
}
