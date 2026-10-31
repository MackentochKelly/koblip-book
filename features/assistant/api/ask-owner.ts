import "server-only"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { AssistantToolDefinition } from "../types"

// The loop's own tool for a question with options to pick from ("Which
// service?"). The loop answers it itself: the question as the reply's
// words (said out loud in talking mode) and the options as buttons, sent
// at once, never waiting on the answer check.
export const ASK_OWNER_TOOL: AssistantToolDefinition = {
  name: "ask_owner",
  description:
    "Ask the owner to pick one of several options (which service, person or extra). " +
    "The screen shows the question with each option as a button. " +
    "Copy each option exactly as a tool result in this turn writes it. Ends your reply.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "One short question, like 'Which service?'",
      },
      options: {
        type: "array",
        items: { type: "string" },
        description: `2-${ASSISTANT_RULES.maxChoices} options, word for word from the tool results`,
      },
    },
    required: ["question", "options"],
    additionalProperties: false,
  },
  needsConfirm: false,
}

// The question and buttons of an ask_owner call, or null when the call is
// unusable: no question, or fewer than 2 options left after cleaning.
export function askOf(
  args: unknown,
  toolResults: string[]
): { question: string; options: string[] } | null {
  if (typeof args !== "object" || args === null) return null
  const { question, options } = args as Record<string, unknown>
  if (typeof question !== "string" || question.trim() === "") return null
  if (
    !Array.isArray(options) ||
    !options.every((option) => typeof option === "string")
  ) {
    return null
  }
  const clean = cleanChoices(options, toolResults)
  return clean === null ? null : { question: question.trim(), options: clean }
}

// Buttons, or null for none: trimmed, de-duplicated, and only options that
// appear word for word in the request's tool results (compared as the
// results hold them, JSON-escaped).
function cleanChoices(
  choices: string[],
  toolResults: string[]
): string[] | null {
  const options: string[] = []
  for (const choice of choices) {
    const name = choice.trim()
    const asStored = JSON.stringify(name).slice(1, -1)
    if (
      name === "" ||
      name.length > ASSISTANT_RULES.maxChoiceChars ||
      !toolResults.some((result) => result.includes(asStored)) ||
      options.includes(name)
    ) {
      continue
    }
    options.push(name)
  }
  return options.length >= 2 && options.length <= ASSISTANT_RULES.maxChoices
    ? options
    : null
}
