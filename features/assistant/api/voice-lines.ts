import "server-only"

import { ASSISTANT_NAME, ASSISTANT_RULES } from "@/lib/assistant-rules"
import { META_TEXT_MODEL, getMetaAiClient } from "@/lib/meta-ai"
import type { PageLanguage } from "@/lib/page-language"
import { VOICE_RULES } from "@/lib/voice-rules"
import type { VoiceLines } from "../types"
import { zonedNow } from "./run-chat"

// What one talk says around its answers, written by the AI when the talk
// starts: a hello, short lines for a slow answer, and small words before an
// answer that cuts one off. A new set each talk, each line said once at most,
// so they never become a pattern. ElevenLabs makes its own filler lines the
// same way, from a small model
// (https://elevenlabs.io/docs/agents-platform/customization/conversation-flow).
// No sample lines here: a model "strongly closely follows" them
// (https://developers.openai.com/cookbook/examples/realtime_prompting_guide).
// The hello is its own call, as the waiting lines take the model several
// seconds and the hello can't wait. Null when the AI can't: talking then just
// has no hello, or no waiting lines.

const counts = VOICE_RULES.voiceLineCounts
const maxChars = VOICE_RULES.voiceLineMaxChars

export interface VoiceLinesContext {
  businessName: string
  timeZone: string
  now: number
  language: PageLanguage
}

const styleOf = (language: PageLanguage) =>
  `Write in ${language === "es" ? "neutral Spanish that sounds right in every country, using tú and never usted" : "English"}, with normal punctuation: the most ordinary everyday words people really say out loud. NEVER slang, and NEVER stiff or robotic phrases.`

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
        model: META_TEXT_MODEL,
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

export async function writeWaitingLines(
  context: VoiceLinesContext,
  signal?: AbortSignal
): Promise<VoiceLines | null> {
  const answer = await writeJson(
    "voice_waiting_lines",
    [
      `${ASSISTANT_NAME} is an AI assistant talking out loud with the owner of a business. Write the short things it says while it works.`,
      styleOf(context.language),
      `fillers: ${counts.fillers} different lines said while checking something for the owner, each at most ${maxChars.filler} characters, most of them 2 to 5 words, each ending in a full stop. They only mean "I'm checking" or "give me a moment". Each must fit any question, so NEVER name what is being looked at (no screen, file, system, data, records). NEVER about being there or staying with the owner, NEVER thanks or sorry, NEVER a promise, a result or how soon it will be.`,
      `cutIns: ${counts.cutIns} different words of one or two words, each at most ${maxChars.cutIn} characters and ending in a comma, said when stopping mid-sentence because the answer was just found. They go right before the answer, so NEVER a word that disagrees or changes the subject.`,
    ].join("\n"),
    {
      type: "object",
      properties: {
        fillers: { type: "array", items: { type: "string" } },
        cutIns: { type: "array", items: { type: "string" } },
      },
      required: ["fillers", "cutIns"],
    },
    signal
  )
  if (!answer) return null
  return {
    fillers: usable(answer.fillers, maxChars.filler, counts.fillers),
    cutIns: usable(answer.cutIns, maxChars.cutIn, counts.cutIns),
  }
}
