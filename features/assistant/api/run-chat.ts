import "server-only"

import type OpenAI from "openai"
import { ASSISTANT_RULES } from "@/lib/assistant-rules"
import type { PageLanguage } from "@/lib/page-language"
import { META_TEXT_MODEL, getMetaAiClient } from "@/lib/meta-ai"
import type {
  AssistantMessage,
  AssistantStreamEvent,
  AssistantTool,
  ConfirmCard,
  SourceKind,
} from "../types"
import { serverMessagesFor } from "../i18n/server"
import {
  buildClockLine,
  buildLanguageLine,
  buildSystemPrompt,
} from "../utils/system-prompt"
import { checkAnswer } from "./check-answer"
import { storePendingAction } from "./pending-actions"

export interface RunChatContext {
  businessName: string
  timeZone: string
  now: number // ms since epoch; passed in so tests control "today"
  ownerId: string
  businessId: string
  language: PageLanguage // owner's language, read once per request
}

interface CollectedCall {
  id: string
  name: string
  argsText: string
}

// Lookup tools and the kind + list key their records come back under.
// Other tools add nothing to the sources event.
const SOURCE_TOOLS: Record<string, { kind: SourceKind; key: string }> = {
  list_bookings: { kind: "bookings", key: "bookings" },
  list_services: { kind: "services", key: "services" },
  list_team: { kind: "team", key: "team" },
  find_customer: { kind: "customers", key: "customers" },
}

// Buttons from a passed answer check, or null for no buttons: trimmed,
// de-duplicated, and only options that appear word for word in this
// request's tool results. A bad choice list never fails the answer.
function cleanChoices(
  choices: string[],
  toolResults: string[]
): string[] | null {
  const options: string[] = []
  for (const choice of choices) {
    const name = choice.trim()
    if (
      name === "" ||
      name.length > ASSISTANT_RULES.maxChoiceChars ||
      !toolResults.some((result) => result.includes(name)) ||
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

// Today in the business timezone, for the system prompt.
function zonedNow(
  now: number,
  timeZone: string
): { date: string; time: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(now)
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday,
  }
}

// A risky call never runs here. Validate, build the card from database
// data, store it, and send the confirm event. Unknown ids produce an
// error result and no card.
async function* handleConfirmCall(
  context: RunChatContext,
  toolName: string,
  confirm: NonNullable<AssistantTool["confirm"]>,
  argsText: string,
  callId: string,
  history: OpenAI.Chat.ChatCompletionMessageParam[]
): AsyncGenerator<AssistantStreamEvent, boolean> {
  const t = serverMessagesFor(context.language)
  const fail = (message: string): void => {
    history.push({
      role: "tool",
      tool_call_id: callId,
      content: JSON.stringify({ error: message }),
    })
  }
  let args: unknown
  try {
    args = JSON.parse(argsText)
  } catch {
    fail(t.loop.invalidArgs)
    return false
  }
  let card: ConfirmCard | { error: string }
  try {
    card = await confirm.describe(args)
  } catch {
    fail(t.loop.lookupFailed)
    return false
  }
  if ("error" in card) {
    fail(card.error)
    return false
  }
  const stored = storePendingAction({
    ownerId: context.ownerId,
    businessId: context.businessId,
    toolName,
    args,
  })
  if ("error" in stored) {
    fail(t.loop.tooMany)
    return false
  }
  yield {
    type: "confirm",
    id: stored.id,
    title: card.title,
    summary: card.summary,
    destructive: card.destructive,
    action: card.action,
  }
  return true
}

// The tool loop. Streams text live, runs tool calls with a step chip each,
// feeds results back, and stops on a plain answer or maxSteps.
// Failures yield error "unavailable"; tool errors stay inside tool results.
// An aborted request ends the stream silently: the reader is gone.
export interface RunChatUsage {
  promptTokens: number
  cachedTokens: number
  completionTokens: number
}

export async function* runChat(
  messages: AssistantMessage[],
  context: RunChatContext,
  tools: AssistantTool[],
  opts?: { signal?: AbortSignal; onUsage?: (usage: RunChatUsage) => void }
): AsyncGenerator<AssistantStreamEvent> {
  const client = getMetaAiClient()
  if (!client) {
    yield { type: "error", code: "unavailable" }
    return
  }
  const t = serverMessagesFor(context.language)
  const byName = new Map(tools.map((t) => [t.definition.name, t]))
  const { date, time, weekday } = zonedNow(context.now, context.timeZone)
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "developer",
      content: buildSystemPrompt(context.businessName, {
        tools: tools.map((t) => ({
          name: t.definition.name,
          description: t.definition.description,
        })),
      }),
    },
    {
      role: "developer",
      content:
        buildClockLine({
          date,
          time,
          weekday,
          timeZone: context.timeZone,
        }) +
        " " +
        buildLanguageLine(context.language),
    },
    ...messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => ({
      role: m.role === "owner" ? "user" : "assistant",
      content: m.text,
    })),
  ]
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

  const retryableStatus = (error: unknown): boolean => {
    const status = (error as { status?: unknown } | null)?.status
    return (
      status === 429 ||
      (typeof status === "number" && status >= 500 && status <= 599)
    )
  }

  try {
    const modelCall = async () => {
      const create = () =>
        client.chat.completions.create(
          {
            model: META_TEXT_MODEL,
            messages: history,
            tools: tools.map((t) => ({
              type: "function",
              function: {
                name: t.definition.name,
                description: t.definition.description,
                parameters: t.definition.parameters,
              },
            })),
            stream: true,
            stream_options: { include_usage: true },
            reasoning_effort: "low",
            // One call per turn: the model reads each result (e.g.
            // find_free_times) before it can ask for the next tool.
            parallel_tool_calls: false,
            max_completion_tokens: ASSISTANT_RULES.maxCompletionTokens,
            // Stable app string so repeated prefixes route together.
            prompt_cache_key: "koblip-owner-assistant",
          },
          { timeout: ASSISTANT_RULES.modelTimeoutMs, signal: opts?.signal }
        )
      // One retry with a short backoff when the provider is overloaded.
      // Only the create() call retries (before the first byte): a stream
      // that already yielded never restarts.
      try {
        return await create()
      } catch (error) {
        if (opts?.signal?.aborted || !retryableStatus(error)) {
          throw error
        }
        console.error("model-call-retry")
        await sleep(500)
        return await create()
      }
    }
    let stopAfterReply = false
    // A non-confirm tool ran in this request: the final answer goes
    // through the judge instead of going out directly.
    let toolsRan = false
    let retriesLeft = ASSISTANT_RULES.answerCheckRetries
    // Last answer that failed a check and is still waiting on its retry.
    let pendingAnswer: string | null = null
    // Records looked up this request, by kind in first-looked-up order.
    // A repeat lookup keeps the highest count; empty kinds stay out.
    const sources = new Map<SourceKind, number>()
    for (let turn = 0; turn < ASSISTANT_RULES.maxSteps; turn += 1) {
      const stream = await modelCall()
      // The owner only ever sees the final answer: every turn's text
      // is held, and only a turn with no tool calls goes out.
      let text = ""
      const calls: CollectedCall[] = []
      for await (const chunk of stream) {
        // Usage arrives on the final chunk, which may carry no choices.
        if (opts?.onUsage && chunk.usage) {
          const total = chunk.usage as {
            prompt_tokens?: unknown
            completion_tokens?: unknown
            prompt_tokens_details?: { cached_tokens?: unknown } | null
          }
          opts.onUsage({
            promptTokens:
              typeof total.prompt_tokens === "number" ? total.prompt_tokens : 0,
            cachedTokens:
              typeof total.prompt_tokens_details?.cached_tokens === "number"
                ? total.prompt_tokens_details.cached_tokens
                : 0,
            completionTokens:
              typeof total.completion_tokens === "number"
                ? total.completion_tokens
                : 0,
          })
        }
        const delta = chunk.choices[0]?.delta
        if (!delta) {
          continue
        }
        if (delta.content) {
          text += delta.content
        }
        for (const tc of delta.tool_calls ?? []) {
          const slot = (calls[tc.index] ??= { id: "", name: "", argsText: "" })
          if (tc.id) {
            slot.id += tc.id
          }
          if (tc.function?.name) {
            slot.name += tc.function.name
          }
          if (tc.function?.arguments) {
            slot.argsText += tc.function.arguments
          }
        }
      }
      if (calls.length === 0) {
        if (!toolsRan) {
          // Nothing was looked up: the answer goes out as one event.
          if (text !== "") {
            yield { type: "text", delta: text }
          }
          yield { type: "done" }
          return
        }
        // Final answer after lookups: check it against this request's
        // tool results before the owner sees it.
        const stepId = `check-${turn}`
        yield {
          type: "step",
          id: stepId,
          label: t.steps.checking,
          status: "running",
        }
        const question =
          [...messages].reverse().find((m) => m.role === "owner")?.text ?? ""
        const toolResults = history.flatMap((m) =>
          m.role === "tool" && typeof m.content === "string" ? [m.content] : []
        )
        // A blank answer never reaches the judge: it rides the failed
        // path with its problem, exactly like an unsupported answer.
        const verdict =
          text.trim() === ""
            ? { ok: false as const, problems: ["The answer was empty."] }
            : await checkAnswer({
                question,
                toolResults,
                answer: text,
                signal: opts?.signal,
              })
        yield {
          type: "step",
          id: stepId,
          label: t.steps.checking,
          status: verdict.ok === true ? "done" : "failed",
        }
        if (verdict.ok === true) {
          pendingAnswer = null
          yield { type: "text", delta: text }
          const items = [...sources].flatMap(([kind, count]) =>
            count > 0 ? [{ kind, count }] : []
          )
          if (items.length > 0) {
            yield { type: "sources", items }
          }
          const options = cleanChoices(verdict.choices, toolResults)
          if (options !== null) {
            yield { type: "choices", options }
          }
          yield { type: "done" }
          return
        }
        if (verdict.ok === false && retriesLeft > 0) {
          // Hide the bad answer and ask for another using only the
          // tool results. This retry counts toward maxSteps.
          retriesLeft -= 1
          pendingAnswer = text
          history.push({ role: "assistant", content: text })
          history.push({
            role: "developer",
            content:
              `Your answer had problems: ${verdict.problems.join("; ")}. ` +
              "Answer again using only the tool results; " +
              "call a tool if you need more data.",
          })
          continue
        }
        if (text.trim() === "") {
          // No answer and no retries: the stopped path, never an
          // empty text event.
          yield {
            type: "text",
            delta: t.loop.stopped(ASSISTANT_RULES.maxSteps),
          }
          yield { type: "done" }
          return
        }
        pendingAnswer = null
        yield { type: "text", delta: text }
        yield { type: "notice", kind: "unverified" }
        yield { type: "done" }
        return
      }
      // Full assistant message first, then one tool message per call,
      // in order, with the matching id.
      const toolCalls: OpenAI.Chat.ChatCompletionMessageFunctionToolCall[] =
        calls.map((c, index) => ({
          id: c.id || `call-${turn}-${index}`,
          type: "function",
          function: { name: c.name, arguments: c.argsText },
        }))
      history.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls,
      })
      for (let i = 0; i < toolCalls.length; i += 1) {
        const call = toolCalls[i]
        const tool = byName.get(call.function.name)
        if (tool?.definition.needsConfirm && tool.confirm) {
          const stored = yield* handleConfirmCall(
            context,
            tool.definition.name,
            tool.confirm,
            call.function.arguments,
            call.id,
            history
          )
          if (stored) {
            stopAfterReply = true
          }
          continue
        }
        const stepId = call.id.slice(0, 64) || `call-${turn}-${i}`
        yield {
          type: "step",
          id: stepId,
          label: tool?.label ?? t.steps.working,
          status: "running",
        }
        let result: unknown
        let ok = true
        try {
          if (!tool) {
            throw new Error(`unknown tool ${call.function.name}`)
          }
          const parsedArgs = JSON.parse(call.function.arguments)
          toolsRan = true
          result = { data: await tool.run(parsedArgs) }
          // Records for the sources event: the main list's length, or
          // nothing when the tool is not a lookup.
          const source = SOURCE_TOOLS[call.function.name]
          const rows = (result as { data?: Record<string, unknown> }).data?.[
            source?.key ?? ""
          ]
          if (source && Array.isArray(rows)) {
            sources.set(
              source.kind,
              Math.max(sources.get(source.kind) ?? 0, rows.length)
            )
          }
        } catch {
          ok = false
          result = { error: t.loop.lookupFailed }
        }
        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        })
        yield {
          type: "step",
          id: stepId,
          label: tool?.label ?? t.steps.working,
          status: ok ? "done" : "failed",
        }
      }
      if (stopAfterReply) {
        // A confirm card went out: the card is the only message. End
        // here with no second model call (cheaper, faster, and the
        // model cannot repeat its pre-call line after the card).
        yield { type: "done" }
        return
      }
    }
    if (pendingAnswer !== null && pendingAnswer.trim() !== "") {
      // A checked answer never got its retry: send the last one
      // with a notice instead of the stopped message.
      yield { type: "text", delta: pendingAnswer }
      yield { type: "notice", kind: "unverified" }
      yield { type: "done" }
      return
    }
    yield {
      type: "text",
      delta: t.loop.stopped(ASSISTANT_RULES.maxSteps),
    }
    yield { type: "done" }
  } catch {
    if (opts?.signal?.aborted) {
      return
    }
    yield { type: "error", code: "unavailable" }
  }
}
