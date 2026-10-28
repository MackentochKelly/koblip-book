import "server-only"

import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import { META_TEXT_MODEL, getMetaAiClient } from "@/lib/meta-ai"

export type AnswerCheck =
  | { ok: true; choices: string[] }
  | { ok: false; problems: string[] }
  | { ok: "unknown" }

// One non-streaming judge call: every fact in the answer must be backed
// by the tool results. Anything else is "unknown", never a throw.
export async function checkAnswer(input: {
  question: string
  toolResults: string[]
  answer: string
  signal?: AbortSignal
}): Promise<AnswerCheck> {
  const fail = (): AnswerCheck => {
    console.error("answer-check-failed")
    return { ok: "unknown" }
  }
  const client = getMetaAiClient()
  if (!client) {
    return fail()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const completion = await Promise.race([
      client.chat.completions.create(
        {
          model: META_TEXT_MODEL,
          messages: [
            {
              role: "developer",
              content:
                "You check an assistant's answer against its tool results before the owner sees it. " +
                "Every fact in the answer (numbers, counts, dates, times, names, prices, statuses) " +
                "must appear in, or follow directly from, the tool results. " +
                "Friendly words, questions back to the owner, and offers of help are fine and need no support. " +
                "If the answer asks the owner to pick one of several options, put each option in choices " +
                "exactly as it is written in the tool results; otherwise choices is an empty array. " +
                "If something is not supported, set supported to false and list each problem in one short sentence.",
            },
            {
              role: "user",
              content:
                `Question: ${input.question}\n\n` +
                `Tool results:\n${input.toolResults.join("\n")}\n\n` +
                `Answer:\n${input.answer}`,
            },
          ],
          reasoning_effort: "low",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "answer_check",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  supported: { type: "boolean" },
                  problems: { type: "array", items: { type: "string" } },
                  choices: { type: "array", items: { type: "string" } },
                },
                required: ["supported", "problems", "choices"],
              },
            },
          },
        },
        {
          timeout: ASSISTANT_RULES.answerCheckTimeoutMs,
          signal: input.signal,
        }
      ),
      new Promise<never>(
        (_, reject) =>
          (timer = setTimeout(
            () => reject(new Error("answer-check-timeout")),
            ASSISTANT_RULES.answerCheckTimeoutMs
          ))
      ),
    ])
    const content = completion.choices[0]?.message?.content
    if (typeof content !== "string") {
      return fail()
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return fail()
    }
    const verdict = parsed as {
      supported?: unknown
      problems?: unknown
      choices?: unknown
    }
    if (verdict.supported === true) {
      // Malformed choices never fail the answer: they just mean no
      // buttons.
      const choices =
        Array.isArray(verdict.choices) &&
        verdict.choices.every((c) => typeof c === "string")
          ? (verdict.choices as string[])
          : []
      return { ok: true, choices }
    }
    if (
      verdict.supported === false &&
      Array.isArray(verdict.problems) &&
      verdict.problems.every((p) => typeof p === "string")
    ) {
      return { ok: false, problems: verdict.problems }
    }
    return fail()
  } catch {
    return fail()
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}
