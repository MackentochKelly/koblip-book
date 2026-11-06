import "server-only"

import {
  ASSISTANT_LANGUAGES,
  ASSISTANT_NAME,
  ASSISTANT_RULES,
} from "@/lib/assistant-rules"
import { META_TALK_MODEL, getMetaAiClient } from "@/lib/meta-ai"
import type { PageLanguage } from "@/lib/page-language"
import { VOICE_RULES } from "@/lib/voice-rules"
import type { VoiceLines } from "../types"
import { zonedNow } from "./run-chat"

// What one talk says around its answers, written by the AI when the talk
// starts: a hello, and small words before an answer that cuts a lookup's line
// off. A new set each talk, each line said once at most, so they never become a
// pattern. No sample lines here: a model "strongly closely follows" them
// (https://developers.openai.com/cookbook/examples/realtime_prompting_guide).
// The hello is its own call, as it can't wait for anything else. Null when the
// AI can't: talking then just has no hello, or no cut-in words.

const counts = VOICE_RULES.voiceLineCounts
const maxChars = VOICE_RULES.voiceLineMaxChars

export interface VoiceLinesContext {
  businessName: string
  timeZone: string
  now: number
  language: PageLanguage
}

// The language the lines are written in, and how they talk to the owner.
const WRITTEN_IN: Record<PageLanguage, string> = {
  en: ASSISTANT_LANGUAGES.en.name,
  es: "neutral Spanish that sounds right in every country, using tú and never usted",
  pt: `${ASSISTANT_LANGUAGES.pt.name}, using você`,
  fr: `${ASSISTANT_LANGUAGES.fr.name}, using vous`,
}

const styleOf = (language: PageLanguage) =>
  `Write in ${WRITTEN_IN[language]}, with normal punctuation: the most ordinary everyday words people really say out loud. NEVER slang, and NEVER stiff or robotic phrases.`

// One call for a JSON answer. Null when it fails or isn't JSON.
async function writeJson(
  name: string,
  prompt: string,
  schema: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  const client = getMetaAiClient()
  if (!client) return null
  try {
    const completion = await client.chat.completions.create(
      {
        model: META_TALK_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: { name, schema },
        },
        reasoning_effort: ASSISTANT_RULES.voiceReasoningEffort,
        // Counts reasoning tokens too, and even minimal effort spends most of
        // it there (https://dev.meta.ai/docs/api-reference/chat-completions/schemas).
        max_completion_tokens: VOICE_RULES.voiceLinesMaxTokens,
      },
      { timeout: VOICE_RULES.voiceLinesTimeoutMs, signal }
    )
    const content = completion.choices[0]?.message?.content
    return content ? (JSON.parse(content) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// The usable lines: words of the right length, each once.
function usable(value: unknown, limit: number, count: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toLowerCase()
      if (line === "" || line.length > limit || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, count)
}

export async function writeGreeting(
  context: VoiceLinesContext,
  signal?: AbortSignal
): Promise<string | null> {
  const { weekday, time } = zonedNow(context.now, context.timeZone)
  const answer = await writeJson(
    "voice_greeting",
    [
      `${ASSISTANT_NAME} is an AI assistant, about to talk out loud with the owner of "${context.businessName}". It is ${weekday}, ${time} there.`,
      styleOf(context.language),
      `greeting: its one short hello that asks what they need, at most ${maxChars.greeting} characters. It may use the name ${ASSISTANT_NAME}. Make it feel fresh, not like a stock phrase. NEVER ask how they are.`,
    ].join("\n"),
    {
      type: "object",
      properties: { greeting: { type: "string" } },
      required: ["greeting"],
    },
    signal
  )
  return usable([answer?.greeting], maxChars.greeting, 1)[0] ?? null
}

export async function writeCutIns(
  context: VoiceLinesContext,
  signal?: AbortSignal
): Promise<VoiceLines | null> {
  const answer = await writeJson(
    "voice_cut_ins",
    [
      `${ASSISTANT_NAME} is an AI assistant talking out loud with the owner of a business.`,
      styleOf(context.language),
      `cutIns: ${counts.cutIns} different words of one or two words, each at most ${maxChars.cutIn} characters and ending in a comma, said when stopping mid-sentence because the answer was just found. They go right before the answer, so NEVER a word that disagrees, changes the subject or asks to wait.`,
    ].join("\n"),
    {
      type: "object",
      properties: {
        cutIns: { type: "array", items: { type: "string" } },
      },
      required: ["cutIns"],
    },
    signal
  )
  if (!answer) return null
  return {
    cutIns: usable(answer.cutIns, maxChars.cutIn, counts.cutIns),
  }
}
