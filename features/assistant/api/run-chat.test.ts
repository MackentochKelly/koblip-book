// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
// The loop only stores cards; the store itself (the database) has its own
// tests in pending-actions.test.ts.
vi.mock("./pending-actions", () => {
  const cards = new Map<string, { toolName: string; args: unknown }>()
  return {
    storePendingAction: vi.fn(
      async (input: { toolName: string; args: unknown }) => {
        const id = crypto.randomUUID()
        cards.set(id, input)
        return { id }
      }
    ),
    peekPendingAction: vi.fn(async (id: string) => cards.get(id) ?? null),
    resetPendingActionsForTests: () => cards.clear(),
  }
})

const { runChat } = await import("./run-chat")
const meta = await import("@/lib/meta-ai")
const { ASSISTANT_RULES } = await import("@/lib/assistant-rules")

const CONTEXT = {
  businessName: "Salon",
  timeZone: "Europe/Madrid",
  now: Date.UTC(2026, 9, 28, 9, 0, 0),
  ownerId: "u1",
  businessId: "b1",
  language: "en" as const,
}
const MESSAGES = [{ role: "owner" as const, text: "hello" }]

function probe(run: (args: unknown) => Promise<unknown>, name = "probe") {
  return {
    definition: {
      name,
      description: "A probe tool.",
      parameters: {},
      needsConfirm: false,
    },
    label: "Probing…",
    doneLabel: "Probed",
    run,
  }
}

const textChunk = (content: string) => ({ choices: [{ delta: { content } }] })
const toolChunk = (
  index: number,
  id?: string,
  name?: string,
  args?: string
) => ({
  choices: [
    {
      delta: {
        tool_calls: [{ index, id, function: { name, arguments: args } }],
      },
    },
  ],
})

// Each turn is a list of chunks; the last turn repeats when exhausted.
// Judge calls (non-streaming bodies with response_format) are answered
// from judgeReplies instead, in order, repeating the last one.
function scriptedClient(turns: unknown[][], judgeReplies: string[] = []) {
  const seen: {
    messages: {
      role: string
      tool_call_id?: string
      tool_calls?: { id: string }[]
    }[]
  }[] = []
  let n = 0
  let j = 0
  const create = vi.fn(
    async (body: { messages: never[]; response_format?: unknown }) => {
      seen.push(body as never)
      if (body.response_format) {
        const reply = judgeReplies[Math.min(j, judgeReplies.length - 1)]
        j += 1
        return { choices: [{ message: { content: reply } }] }
      }
      const chunks = turns[Math.min(n, turns.length - 1)]
      n += 1
      return (async function* () {
        for (const c of chunks) {
          yield c
        }
      })()
    }
  )
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  return { seen, create }
}

const judgeOk = (choices: string[] = []) =>
  JSON.stringify({ supported: true, problems: [], choices })
const judgeNo = (problems: string[]) =>
  JSON.stringify({ supported: false, problems })

function judgeBodies(create: ReturnType<typeof vi.fn>) {
  return create.mock.calls
    .map(([body]) => body as Record<string, unknown>)
    .filter((body) => "response_format" in body)
}

async function collect(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const events: unknown[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

const { answerCheckEvents, resetAnswerChecksForTests, takeAnswerCheck } =
  await import("./answer-checks")

beforeEach(() => resetAnswerChecksForTests())

// The answer's events, then the events of the check it left behind, as
// POST /api/assistant/check sends them right after.
async function collectChecked(
  gen: AsyncGenerator<unknown>
): Promise<{ answer: unknown[]; check: unknown[] }> {
  const answer = await collect(gen)
  const event = answer.find((e) => (e as { type: string }).type === "check")
  if (!event) return { answer, check: [] }
  const check = takeAnswerCheck(
    (event as { id: string }).id,
    CONTEXT.ownerId,
    CONTEXT.businessId
  )
  return { answer, check: check ? await collect(answerCheckEvents(check)) : [] }
}

const CHECK = {
  type: "check",
  id: expect.any(String),
  label: "Checking the answer…",
}
const CHECKED = {
  type: "step",
  id: expect.any(String),
  label: "Answer checked",
  status: "done",
}
const NOT_CHECKED = {
  ...CHECKED,
  label: "Couldn't check the answer",
  status: "failed",
}

test("plain answer sends one text event then done, with tools offered", async () => {
  const { seen } = scriptedClient([[textChunk("Hi"), textChunk("!")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  // Typed: a short answer comes whole once the turn ends with no tool.
  expect(events).toEqual([{ type: "text", delta: "Hi!" }, { type: "done" }])
  const body = seen[0] as unknown as {
    tools: { function: { name: string } }[]
    stream: boolean
    reasoning_effort: string
    parallel_tool_calls: boolean
  }
  expect(body.tools.map((t) => t.function.name)).toEqual(["probe", "ask_owner"])
  expect(body.stream).toBe(true)
  expect(body.reasoning_effort).toBe("low")
  expect(body.parallel_tool_calls).toBe(false)
})

test("tool call then final answer, ids matched in order", async () => {
  const run = vi.fn(async (args: unknown) => ({ echo: args }))
  scriptedClient(
    [
      [
        toolChunk(0, "call-A", "pro", '{"a"'),
        toolChunk(0, undefined, "be", ":1}"),
        toolChunk(1, "call-B", "probe", "{}"),
      ],
      [textChunk("Done.")],
    ],
    [judgeOk()]
  )
  const events = await collect(runChat(MESSAGES, CONTEXT, [probe(run)]))
  expect(events).toEqual([
    { type: "step", id: "call-A", label: "Probing…", status: "running" },
    { type: "step", id: "call-A", label: "Probed", status: "done" },
    { type: "step", id: "call-B", label: "Probing…", status: "running" },
    { type: "step", id: "call-B", label: "Probed", status: "done" },
    { type: "text", delta: "Done." },
    CHECK,
    { type: "done" },
  ])
  expect(run).toHaveBeenCalledTimes(2)
  expect(run).toHaveBeenNthCalledWith(1, { a: 1 })
  expect(run).toHaveBeenNthCalledWith(2, {})
})

test("talking streams its line before a lookup and separates later text", async () => {
  scriptedClient(
    [
      [textChunk("Checking."), toolChunk(0, "a", "probe", "{}")],
      [toolChunk(0, "b", "probe", "{}")],
      [textChunk("Two"), textChunk(" bookings.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, [probe(async () => ({}))])
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [
      { type: "text", delta: "Checking." },
      { type: "text", delta: "\n\n" },
      { type: "text", delta: "Two" },
      { type: "text", delta: " bookings." },
    ]
  )
})

test("typed: words written before a tool call never show", async () => {
  scriptedClient(
    [
      [textChunk("Booking flow needs a lookup."), toolChunk(0, "a", "probe", "{}")],
      [textChunk("Two"), textChunk(" bookings.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [{ type: "text", delta: "Two bookings." }]
  )
})

test("typed: a long answer streams once enough words and a sentence have come", async () => {
  const first = "x".repeat(ASSISTANT_RULES.typedHoldChars) + ". "
  scriptedClient([[textChunk(first), textChunk("Ana at 3"), textChunk(" and Leo.")]])
  const events = await collect(runChat(MESSAGES, CONTEXT, []))
  expect(events).toEqual([
    { type: "text", delta: first + "Ana at 3" },
    { type: "text", delta: " and Leo." },
    { type: "done" },
  ])
})

test("typed: two short sentences before a tool call never show", async () => {
  scriptedClient(
    [
      [textChunk("Which service? "), textChunk("I'll fetch the options."), toolChunk(0, "a", "probe", "{}")],
      [textChunk("Two bookings.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [{ type: "text", delta: "Two bookings." }]
  )
})

test("second model call carries full assistant message plus ordered tool results", async () => {
  const { create } = scriptedClient(
    [
      [
        toolChunk(0, "call-A", "probe", '{"a":1}'),
        toolChunk(1, "call-B", "probe", "{}"),
      ],
      [textChunk("ok")],
    ],
    [judgeOk()]
  )
  await collect(
    runChat(MESSAGES, CONTEXT, [probe(async (args) => ({ echo: args }))])
  )
  const second = create.mock.calls[1][0] as unknown as {
    messages: {
      role: string
      tool_calls?: {
        id: string
        function: { name: string; arguments: string }
      }[]
      tool_call_id?: string
      content: string | null
    }[]
  }
  const assistant = second.messages.find((m) => m.tool_calls)
  expect(assistant?.tool_calls?.map((c) => c.id)).toEqual(["call-A", "call-B"])
  const tools = second.messages.filter((m) => m.role === "tool")
  expect(tools.map((m) => m.tool_call_id)).toEqual(["call-A", "call-B"])
  expect(tools[0].content).toContain('{"a":1}')
})

test("invalid JSON arguments fail the step without running", async () => {
  const run = vi.fn(async () => ({}))
  scriptedClient([
    [toolChunk(0, "call-A", "probe", "{nope")],
    [textChunk("ok")],
  ])
  const events = await collect(runChat(MESSAGES, CONTEXT, [probe(run)]))
  expect(run).not.toHaveBeenCalled()
  expect(events).toContainEqual({
    type: "step",
    id: "call-A",
    label: "Probing…",
    status: "failed",
  })
  expect(events[events.length - 1]).toEqual({ type: "done" })
})

test("throwing tool fails the step without leaking", async () => {
  scriptedClient(
    [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("ok")]],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => {
        throw new Error("secret db detail")
      }),
    ])
  )
  expect(events).toContainEqual({
    type: "step",
    id: "call-A",
    label: "Probing…",
    status: "failed",
  })
  expect(JSON.stringify(events)).not.toContain("secret db detail")
})

test("a tool that refuses fails the step, and the model reads why", async () => {
  const { create } = scriptedClient(
    [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("Can't yet.")]],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ error: "that booking hasn't happened yet" })),
    ])
  )
  expect(events).toContainEqual({
    type: "step",
    id: "call-A",
    label: "Probing…",
    status: "failed",
  })
  const second = create.mock.calls[1][0] as {
    messages: { role: string; content: unknown }[]
  }
  expect(
    second.messages.find((m) => m.role === "tool")?.content
  ).toContain("that booking hasn't happened yet")
})

test("unknown tool name fails the step", async () => {
  scriptedClient([[toolChunk(0, "call-A", "nope", "{}")], [textChunk("ok")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toContainEqual({
    type: "step",
    id: "call-A",
    label: "Working…",
    status: "failed",
  })
})

test("stops after maxSteps with a short text and done", async () => {
  const { create } = scriptedClient([[toolChunk(0, "call-A", "probe", "{}")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(create).toHaveBeenCalledTimes(ASSISTANT_RULES.maxSteps)
  expect(events[events.length - 2]).toMatchObject({ type: "text" })
  expect(events[events.length - 1]).toEqual({ type: "done" })
})

test("missing key yields unavailable", async () => {
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue(null)
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toEqual([{ type: "error", code: "unavailable" }])
})

const { peekPendingAction } = await import("./pending-actions")
// The stand-in store's own reset (see the mock above).
const { resetPendingActionsForTests } =
  (await import("./pending-actions")) as unknown as {
    resetPendingActionsForTests: () => void
  }

function risky(describe: (args: unknown) => Promise<unknown>) {
  return {
    definition: {
      name: "cancel_booking",
      description: "Cancel a booking. Needs the owner's tap.",
      parameters: {},
      needsConfirm: true,
    },
    label: "Cancelling…",
    doneLabel: "Cancelled",
    run: async () => ({ error: "needs tap" }),
    confirm: {
      describe: describe as (args: unknown) => Promise<
        | {
            title: string
            summary: string
            destructive: boolean
            action: string
            args?: unknown
          }
        | { error: string }
      >,
      execute: async () => ({ ok: true, doneText: "done" }),
    },
  }
}

test("risky tool stores a card and ends the turn with no second call", async () => {
  resetPendingActionsForTests()
  const run = vi.fn(async () => ({}))
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "cancel_booking", '{"bookingId":"k1"}')],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      risky(async () => ({
        title: "Cancel?",
        summary: "Ana",
        destructive: true,
        action: "Cancel booking",
      })),
      probe(run),
    ])
  )
  expect(run).not.toHaveBeenCalled()
  // No text goes out before the card: the card is the only message.
  expect(events).toEqual([
    {
      type: "confirm",
      id: expect.any(String),
      title: "Cancel?",
      summary: "Ana",
      destructive: true,
      action: "Cancel booking",
    },
    { type: "done" },
  ])
  expect(create).toHaveBeenCalledTimes(1)
  const id = (events[0] as { id: string }).id
  expect((await peekPendingAction(id))?.toolName).toBe("cancel_booking")
})

test("a card's resolved args are stored, not the model's words", async () => {
  resetPendingActionsForTests()
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "cancel_booking", '{"day":"today"}')],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      risky(async () => ({
        title: "Book?",
        summary: "Ana",
        destructive: false,
        action: "Book",
        args: { date: "2099-01-01" },
      })),
    ])
  )
  expect(create).toHaveBeenCalledTimes(1)
  // The resolved args never reach the screen.
  expect(events[0]).not.toHaveProperty("args")
  const id = (events[0] as { id: string }).id
  expect((await peekPendingAction(id))?.args).toEqual({ date: "2099-01-01" })
})

test("a lookup's records come back as memory and spare the next lookup", async () => {
  resetPendingActionsForTests()
  scriptedClient(
    [
      [toolChunk(0, "call-A", "list_bookings", '{"day":"today"}')],
      [textChunk("Ana at 10, Leo at 11.")],
    ],
    [judgeOk()]
  )
  const listed = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(
        async () => ({
          bookings: [
            {
              id: "k1",
              customer: "Ana",
              service: "Cut",
              date: "2026-10-28",
              time: "10:00",
              dayText: "Wednesday, October 28",
              timeText: "10:00 AM",
              status: "confirmed",
            },
            { id: "k2", customer: "Leo", service: "Fade" },
          ],
        }),
        "list_bookings"
      ),
    ])
  )
  const memory = listed.find(
    (e) => (e as { type: string }).type === "memory"
  ) as { rows: unknown[] }
  expect(memory.rows).toEqual([
    {
      kind: "booking",
      id: "k1",
      label: "Ana · Cut · Wednesday, October 28 10:00 AM · confirmed",
    },
    { kind: "booking", id: "k2", label: "Leo · Fade" },
  ])
  // Next question: the ids are in the model's notes, so it calls cancel
  // straight away, with no second list_bookings.
  const list = vi.fn(async () => ({ bookings: [] }))
  const { seen } = scriptedClient([
    [toolChunk(0, "call-B", "cancel_booking", '{"bookingId":"k1"}')],
  ])
  const carded = await collect(
    runChat(
      [
        ...MESSAGES,
        {
          role: "assistant",
          text: "Ana at 10, Leo at 11.",
          memory: memory.rows as never,
        },
        { role: "owner", text: "cancel Ana's" },
      ],
      CONTEXT,
      [
        probe(list, "list_bookings"),
        risky(async () => ({
          title: "Cancel?",
          summary: "Ana",
          destructive: true,
          action: "Cancel booking",
        })),
      ]
    )
  )
  expect(list).not.toHaveBeenCalled()
  expect(carded[0]).toMatchObject({ type: "confirm" })
  const notes = seen[0].messages.filter(
    (m) =>
      m.role === "developer" &&
      String((m as { content?: unknown }).content).includes("k1")
  )
  expect(notes).toHaveLength(1)
  // The note sits right after the answer it belongs to.
  const at = seen[0].messages.indexOf(notes[0])
  expect(seen[0].messages[at - 1]).toMatchObject({ role: "assistant" })
})

test("only the newest few answers' records are shown to the model", async () => {
  const { seen } = scriptedClient([[textChunk("Hi")]])
  const answer = (id: string) => ({
    role: "assistant" as const,
    text: "ok",
    memory: [{ kind: "service" as const, id, label: id }],
  })
  await collect(
    runChat(
      [
        ...MESSAGES,
        answer("s1"),
        { role: "owner", text: "a" },
        answer("s2"),
        { role: "owner", text: "b" },
        answer("s3"),
        { role: "owner", text: "c" },
        answer("s4"),
        { role: "owner", text: "d" },
      ],
      CONTEXT,
      []
    )
  )
  const notes = seen[0].messages
    .filter((m) => m.role === "developer")
    .map((m) => String((m as { content?: unknown }).content))
    .filter((c) => c.startsWith("Records"))
  expect(notes).toHaveLength(ASSISTANT_RULES.maxMemoryReplies)
  expect(notes.some((c) => c.includes('"s1"'))).toBe(false)
  expect(notes.at(-1)).toContain('"s4"')
})

test("an aborted request ends the stream silently", async () => {
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: {
      completions: {
        create: vi.fn(async () => {
          throw new DOMException("aborted", "AbortError")
        }),
      },
    },
  } as never)
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))], {
      signal: AbortSignal.abort(),
    })
  )
  expect(events).toEqual([])
})

test("a 429 retries once, then streams", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    let calls = 0
    vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
      chat: {
        completions: {
          create: vi.fn(async () => {
            calls += 1
            if (calls === 1) {
              throw { status: 429 }
            }
            return (async function* () {
              yield textChunk("hi")
            })()
          }),
        },
      },
    } as never)
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
    )
    expect(events).toEqual([{ type: "text", delta: "hi" }, { type: "done" }])
    expect(error).toHaveBeenCalledWith("model-call-retry")
  } finally {
    error.mockRestore()
  }
})

test("a repeated 429 gives unavailable after exactly one retry", async () => {
  const create = vi.fn(async () => {
    throw { status: 429 }
  })
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
    )
    expect(events).toEqual([{ type: "error", code: "unavailable" }])
    expect(create).toHaveBeenCalledTimes(2)
  } finally {
    error.mockRestore()
  }
})

test("a 400 never retries", async () => {
  const create = vi.fn(async () => {
    throw { status: 400 }
  })
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toEqual([{ type: "error", code: "unavailable" }])
  expect(create).toHaveBeenCalledTimes(1)
})

test("no key, phone, or provider text ever reaches the console", async () => {
  process.env.MODEL_API_KEY = "test-key-abc123"
  const phone = "+15551234567"
  const secret = "provider blew up"
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  try {
    vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
      chat: {
        completions: {
          create: vi.fn(async () => {
            throw new Error(`${secret} ${phone}`)
          }),
        },
      },
    } as never)
    await collect(
      runChat([{ role: "owner", text: `call ${phone}` }], CONTEXT, [
        {
          definition: {
            name: "x",
            description: "x",
            parameters: {},
            needsConfirm: false,
          },
          label: "X",
          doneLabel: "X",
          run: async () => {
            throw new Error(`${secret} ${phone}`)
          },
        },
      ])
    )
    const printed = [...error.mock.calls.flat(), ...log.mock.calls.flat()].join(
      " "
    )
    expect(printed).not.toContain("test-key-abc123")
    expect(printed).not.toContain(phone)
    expect(printed).not.toContain(secret)
  } finally {
    error.mockRestore()
    log.mockRestore()
    delete process.env.MODEL_API_KEY
  }
})

test("unknown id in a risky call gives no card and keeps looping", async () => {
  resetPendingActionsForTests()
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "cancel_booking", '{"bookingId":"nope"}')],
    [textChunk("Which one?")],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      risky(async () => ({ error: "unknown booking id" })),
    ])
  )
  expect(events.some((e) => (e as { type: string }).type === "confirm")).toBe(
    false
  )
  expect(events).toContainEqual({ type: "text", delta: "Which one?" })
  expect(create).toHaveBeenCalledTimes(2)
})

const CONTEXT_ES = { ...CONTEXT, language: "es" as const }

test("spanish context tells the model to reply in spanish", async () => {
  const { create } = scriptedClient([[textChunk("hola")]])
  await collect(runChat(MESSAGES, CONTEXT_ES, [probe(async () => ({}))]))
  const body = create.mock.calls[0]?.[0] as {
    messages: { content: string }[]
  }
  expect(body.messages[1]?.content).toContain("Responde en español.")
})

test("spanish context uses spanish fallbacks and stop text", async () => {
  scriptedClient([[toolChunk(0, "call-A", "nope", "{}")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT_ES, [probe(async () => ({}))])
  )
  expect(events).toContainEqual({
    type: "step",
    id: "call-A",
    label: "Trabajando…",
    status: "failed",
  })
  expect(events).toContainEqual({
    type: "text",
    delta: expect.stringContaining("Me quedé sin pasos"),
  })
})

test("spanish context reports invalid arguments in spanish", async () => {
  resetPendingActionsForTests()
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "cancel_booking", "not json")],
    [textChunk("ok")],
  ])
  await collect(
    runChat(MESSAGES, CONTEXT_ES, [
      risky(async () => {
        throw new Error("unreached")
      }),
    ])
  )
  const second = create.mock.calls[1]?.[0] as {
    messages: { role: string; content: string }[]
  }
  const toolMessage = second.messages.find((m) => m.role === "tool")
  expect(toolMessage?.content).toContain("esos argumentos no eran válidos")
})

test("no tool means one text event and no judge call", async () => {
  const { create } = scriptedClient([[textChunk("Hi"), textChunk("!")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toEqual([{ type: "text", delta: "Hi!" }, { type: "done" }])
  expect(judgeBodies(create)).toEqual([])
})

test("a supported answer ends at once, and its check passes after", async () => {
  const { create } = scriptedClient(
    [
      [toolChunk(0, "call-A", "probe", "{}")],
      [textChunk("You have 2 bookings.")],
    ],
    [judgeOk()]
  )
  const answer = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({ today: 2 }))])
  )
  expect(answer).toEqual([
    { type: "step", id: "call-A", label: "Probing…", status: "running" },
    { type: "step", id: "call-A", label: "Probed", status: "done" },
    { type: "text", delta: "You have 2 bookings." },
    CHECK,
    { type: "done" },
  ])
  // Nothing waited for the check.
  expect(judgeBodies(create)).toHaveLength(0)
  const id = (answer[3] as { id: string }).id
  const check = takeAnswerCheck(id, CONTEXT.ownerId, CONTEXT.businessId)
  expect(check).toMatchObject({
    question: "hello",
    answer: "You have 2 bookings.",
    toolResults: ['{"data":{"today":2}}'],
  })
  expect(await collect(answerCheckEvents(check!))).toEqual([
    { ...CHECKED, id },
    { type: "done" },
  ])
  expect(judgeBodies(create)).toHaveLength(1)
  // Single use, and only for its owner and business.
  expect(takeAnswerCheck(id, CONTEXT.ownerId, CONTEXT.businessId)).toBeNull()
})

test("a check is only for its owner and business, and expires", async () => {
  scriptedClient(
    [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("2 bookings.")]],
    [judgeOk()]
  )
  const answer = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  const id = (
    answer.find((e) => (e as { type: string }).type === "check") as {
      id: string
    }
  ).id
  expect(takeAnswerCheck(id, "someone-else", CONTEXT.businessId)).toBeNull()
  expect(takeAnswerCheck(id, CONTEXT.ownerId, "other-business")).toBeNull()
  expect(
    takeAnswerCheck(
      id,
      CONTEXT.ownerId,
      CONTEXT.businessId,
      Date.now() + 121_000
    )
  ).toBeNull()
})

test("unknown judge verdict sends the answer marked unverified", async () => {
  scriptedClient(
    [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("2 bookings.")]],
    ["not json"]
  )
  const { answer, check } = await collectChecked(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(answer).toContainEqual({ type: "text", delta: "2 bookings." })
  expect(check).toEqual([
    NOT_CHECKED,
    { type: "notice", kind: "unverified" },
    { type: "done" },
  ])
})

test("confirm card makes no judge call", async () => {
  resetPendingActionsForTests()
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "cancel_booking", '{"bookingId":"k1"}')],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      risky(async () => ({
        title: "Cancel?",
        summary: "Ana",
        destructive: true,
        action: "Cancel booking",
      })),
    ])
  )
  expect(events.some((e) => (e as { type: string }).type === "confirm")).toBe(
    true
  )
  expect(judgeBodies(create)).toEqual([])
})

const askChunk = (question: string, options: string[]) =>
  toolChunk(0, "call-Q", "ask_owner", JSON.stringify({ question, options }))

test("ask_owner sends the question and its buttons at once, with no check", async () => {
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "probe", "{}")],
    [askChunk("Which service?", ["Classic Haircut", "Skin Fade"])],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({
        services: [{ name: "Classic Haircut" }, { name: "Skin Fade" }],
      })),
    ])
  )
  expect(events).toEqual([
    { type: "step", id: "call-A", label: "Probing…", status: "running" },
    { type: "step", id: "call-A", label: "Probed", status: "done" },
    { type: "text", delta: "Which service?" },
    { type: "choices", options: ["Classic Haircut", "Skin Fade"] },
    { type: "done" },
  ])
  expect(judgeBodies(create)).toEqual([])
})

test("a question the model wrote with the call is not asked twice", async () => {
  const turns = [
    [toolChunk(0, "call-A", "probe", "{}")],
    [textChunk("Which service would you like?"), askChunk("Which service?", ["Cut", "Fade"])],
  ]
  const tools = [
    probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
  ]
  // Typed: the held words never show; ask_owner's question does, once.
  scriptedClient(turns)
  const typed = await collect(runChat(MESSAGES, CONTEXT, tools))
  expect(typed.filter((e) => (e as { type: string }).type === "text")).toEqual([
    { type: "text", delta: "Which service?" },
  ])
  // Talking: its words were already said and ask, so only buttons come.
  scriptedClient(turns)
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, tools)
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual([
    { type: "text", delta: "Which service would you like?" },
  ])
  expect(events.slice(-2)).toEqual([
    { type: "choices", options: ["Cut", "Fade"] },
    { type: "done" },
  ])
})

test("ask_owner's question shows when the words before it ask nothing", async () => {
  for (const turns of [
    // A line before the lookup, then the call alone.
    [
      [textChunk("Two match."), toolChunk(0, "call-A", "probe", "{}")],
      [askChunk("Which one?", ["Cut", "Fade"])],
    ],
    // A plain statement written with the call.
    [
      [toolChunk(0, "call-A", "probe", "{}")],
      [textChunk("Two match."), askChunk("Which one?", ["Cut", "Fade"])],
    ],
  ]) {
    scriptedClient(turns)
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [
        probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
      ])
    )
    // Typed: "Two match." was written with a tool call, so it never shows.
    expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual([
      { type: "text", delta: "Which one?" },
    ])
    expect(events.slice(-2)).toEqual([
      { type: "choices", options: ["Cut", "Fade"] },
      { type: "done" },
    ])
  }
})

test("ask_owner options are trimmed, de-duplicated and kept only when found", async () => {
  scriptedClient([
    [toolChunk(0, "call-A", "probe", "{}")],
    [askChunk("Which one?", [" Cut ", "Cut", "Nope", "x".repeat(61), "Fade"])],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
    ])
  )
  expect(events).toContainEqual({ type: "choices", options: ["Cut", "Fade"] })
})

test("a name with quotes matches as the tool result stores it", async () => {
  scriptedClient([
    [toolChunk(0, "call-A", "probe", "{}")],
    [askChunk("Which one?", ['The "Classic"', "Fade"])],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({
        services: [{ name: 'The "Classic"' }, { name: "Fade" }],
      })),
    ])
  )
  expect(events).toContainEqual({
    type: "choices",
    options: ['The "Classic"', "Fade"],
  })
})

test("an unusable ask_owner goes back to the model, which asks in words", async () => {
  for (const args of [
    JSON.stringify({ question: "Which?", options: ["Cut"] }),
    JSON.stringify({ question: "Which?", options: ["Cut", "Nope"] }),
    JSON.stringify({ question: " ", options: ["Cut", "Fade"] }),
    JSON.stringify({ question: "Which?", options: "Cut" }),
    "{not json",
  ]) {
    const { seen } = scriptedClient(
      [
        [toolChunk(0, "call-A", "probe", "{}")],
        [toolChunk(0, "call-Q", "ask_owner", args)],
        [textChunk("Cut or Fade?")],
      ],
      [judgeOk()]
    )
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [
        probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
      ])
    )
    expect(events.some((e) => (e as { type: string }).type === "choices")).toBe(
      false
    )
    expect(events.slice(-3)).toEqual([
      { type: "text", delta: "Cut or Fade?" },
      CHECK,
      { type: "done" },
    ])
    const answered = seen[2].messages.find(
      (m) => m.role === "tool" && m.tool_call_id === "call-Q"
    ) as { content: string } | undefined
    expect(JSON.parse(answered?.content ?? "{}")).toEqual({
      error: expect.stringContaining("no buttons"),
    })
  }
})

function services(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `Cut ${i}` }))
}

test("a barbershop's 8 services all come as buttons, 49 go back to the model", async () => {
  for (const [count, buttons] of [
    [8, true],
    [49, false],
  ] as const) {
    const list = services(count)
    scriptedClient(
      [
        [toolChunk(0, "call-A", "probe", "{}")],
        [askChunk("Which one?", list.map((s) => s.name))],
        [textChunk("There are many, which one?")],
      ],
      [judgeOk()]
    )
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [probe(async () => ({ services: list }))])
    )
    const choices = events.find(
      (e) => (e as { type: string }).type === "choices"
    )
    expect(choices).toEqual(
      buttons
        ? { type: "choices", options: list.map((s) => s.name) }
        : undefined
    )
  }
})

test("talking mode asks with buttons too, the question said out loud", async () => {
  const { seen } = scriptedClient([
    [textChunk("Lemme see."), toolChunk(0, "call-A", "probe", "{}")],
    [askChunk("Cut, Fade, or something else?", ["Cut", "Fade"])],
  ])
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, [
      probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
    ])
  )
  const body = seen[0] as unknown as {
    tools: { function: { name: string } }[]
    messages: { content: string }[]
  }
  expect(body.tools.map((t) => t.function.name)).toEqual(["probe", "ask_owner"])
  expect(body.messages[0].content).toContain("ask_owner")
  expect(events.slice(-3)).toEqual([
    { type: "text", delta: "Cut, Fade, or something else?" },
    { type: "choices", options: ["Cut", "Fade"] },
    { type: "done" },
  ])
})

test("sources follow a passed answer with kinds and counts", async () => {
  scriptedClient(
    [
      [
        toolChunk(0, "call-A", "list_services", "{}"),
        toolChunk(1, "call-B", "list_bookings", "{}"),
      ],
      [textChunk("Here they are.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: services(3) }), "list_services"),
      probe(
        async () => ({ bookings: [{ id: "k1" }, { id: "k2" }] }),
        "list_bookings"
      ),
    ])
  )
  const at = events.findIndex((e) => (e as { type: string }).type === "text")
  expect(events.slice(at).map((e) => (e as { type: string }).type)).toEqual([
    "text",
    "check",
    "sources",
    "memory",
    "done",
  ])
  expect(events).toContainEqual({
    type: "sources",
    items: [
      { kind: "services", count: 3 },
      { kind: "bookings", count: 2 },
    ],
  })
})

test("sources keep the highest count and leave out zeros", async () => {
  scriptedClient(
    [
      [
        toolChunk(0, "call-A", "list_services", "{}"),
        toolChunk(1, "call-B", "list_services", "{}"),
        toolChunk(2, "call-C", "list_team", "{}"),
        toolChunk(3, "call-D", "find_free_times", "{}"),
      ],
      [textChunk("Done.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: services(2) }), "list_services"),
      probe(async () => ({ services: services(5) }), "list_services"),
      probe(async () => ({ team: [] }), "list_team"),
      probe(async () => ({ slots: ["10:00"] }), "find_free_times"),
    ])
  )
  expect(events).toContainEqual({
    type: "sources",
    items: [{ kind: "services", count: 5 }],
  })
})

test("sources with an unverified answer, no sources after a confirm card", async () => {
  scriptedClient(
    [[toolChunk(0, "call-A", "list_services", "{}")], [textChunk("Nope.")]],
    ["not json"]
  )
  const unverified = await collectChecked(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: services(2) }), "list_services"),
    ])
  )
  expect(unverified.check).toContainEqual({
    type: "notice",
    kind: "unverified",
  })
  expect(
    unverified.answer.some((e) => (e as { type: string }).type === "sources")
  ).toBe(true)
  resetPendingActionsForTests()
  scriptedClient([
    [
      toolChunk(0, "call-A", "list_services", "{}"),
      toolChunk(1, "call-B", "cancel_booking", '{"bookingId":"k1"}'),
    ],
  ])
  const carded = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: services(2) }), "list_services"),
      risky(async () => ({
        title: "Cancel?",
        summary: "Ana",
        destructive: true,
        action: "Cancel booking",
      })),
    ])
  )
  expect(carded.some((e) => (e as { type: string }).type === "confirm")).toBe(
    true
  )
  expect(carded.some((e) => (e as { type: string }).type === "sources")).toBe(
    false
  )
})

test("voice uses minimal reasoning and its answer is checked after", async () => {
  const { create } = scriptedClient(
    [
      [textChunk("Checking."), toolChunk(0, "a", "list_bookings", "{}")],
      [textChunk("Ana or Leo?")],
    ],
    [judgeNo(["Wrong count"])]
  )
  const voice = { ...CONTEXT, voice: true }
  const tools = [
    probe(
      async () => ({ bookings: [{ name: "Ana" }, { name: "Leo" }] }),
      "list_bookings"
    ),
  ]
  const { answer, check } = await collectChecked(
    runChat(MESSAGES, voice, tools)
  )
  for (const [body] of create.mock.calls.slice(0, 2))
    expect(body).toMatchObject({ reasoning_effort: "minimal" })
  // The answer ends before the check, which comes after.
  expect(answer.slice(-3)).toEqual([
    CHECK,
    { type: "sources", items: [{ kind: "bookings", count: 2 }] },
    { type: "done" },
  ])
  expect(check).toEqual([
    NOT_CHECKED,
    { type: "notice", kind: "unverified" },
    { type: "done" },
  ])
})

test("voice gets the time picker too", async () => {
  scriptedClient(
    [[toolChunk(0, "a", "find_free_times", "{}")], [textChunk("At nine?")]],
    [judgeOk()]
  )
  const answer = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, [
      probe(
        async () => ({
          service: "Cut",
          teamMember: null,
          days: [{ date: "2026-10-28", times: ["09:00"] }],
        }),
        "find_free_times"
      ),
    ])
  )
  expect(answer).toContainEqual({
    type: "times",
    today: "2026-10-28",
    service: "Cut",
    teamMember: null,
    days: [{ date: "2026-10-28", times: ["09:00"] }],
  })
})

test("text is yielded before the model stream advances", async () => {
  let advanced = false
  const create = vi.fn(async () =>
    (async function* () {
      yield textChunk("First")
      advanced = true
      yield textChunk(" second")
    })()
  )
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  // Talking mode streams every word at once.
  const gen = runChat(MESSAGES, { ...CONTEXT, voice: true }, [])
  expect(await gen.next()).toEqual({
    value: { type: "text", delta: "First" },
    done: false,
  })
  expect(advanced).toBe(false)
  await collect(gen)
})

test("typed failure sends sources and notice without another model turn", async () => {
  const { create } = scriptedClient(
    [[toolChunk(0, "a", "list_services", "{}")], [textChunk("Wrong.")]],
    [judgeNo(["Wrong count"])]
  )
  const { answer, check } = await collectChecked(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: [{}] }), "list_services"),
    ])
  )
  expect(create).toHaveBeenCalledTimes(3)
  expect(answer.slice(-4)).toEqual([
    { type: "text", delta: "Wrong." },
    CHECK,
    { type: "sources", items: [{ kind: "services", count: 1 }] },
    { type: "done" },
  ])
  expect(check).toEqual([
    NOT_CHECKED,
    { type: "notice", kind: "unverified" },
    { type: "done" },
  ])
})

test.each([false, true])(
  "empty final answer after tools stops, voice=%s",
  async (voice) => {
    const { create } = scriptedClient([[toolChunk(0, "a", "probe", "{}")], []])
    const events = await collect(
      runChat(MESSAGES, { ...CONTEXT, voice }, [probe(async () => ({}))])
    )
    expect(create).toHaveBeenCalledTimes(2)
    expect(judgeBodies(create)).toEqual([])
    expect(events.slice(-2)).toEqual([
      { type: "text", delta: expect.stringContaining("ran out") },
      { type: "done" },
    ])
  }
)

test.each([false, true])(
  "interruption history notes apply in typed and voice modes, voice=%s",
  async (voice) => {
    const { INTERRUPTED_REPLY_NOTE, INTERRUPTED_BEFORE_WORDS_NOTE } =
      await import("../utils/system-prompt")
    for (const language of ["en", "es"] as const) {
      for (const scenario of [
        "partial",
        "silent",
        "normal",
        "false",
      ] as const) {
        const { create } = scriptedClient([[textChunk("Hi")]])
        const history: import("../types").AssistantMessage[] = [
          { role: "owner", text: "Sofia?" },
        ]
        if (scenario !== "silent")
          history.push({
            role: "assistant",
            text: "Yep, let me",
            ...(scenario === "partial"
              ? { interrupted: true }
              : scenario === "false"
                ? { interrupted: false }
                : {}),
          })
        history.push({ role: "owner", text: "Stingray?" })
        await collect(runChat(history, { ...CONTEXT, language, voice }, []))
        const body = create.mock.calls[0][0] as {
          messages: { role: string; content: string }[]
        }
        const expected =
          scenario === "partial"
            ? `${INTERRUPTED_REPLY_NOTE}\nStingray?`
            : scenario === "silent"
              ? `${INTERRUPTED_BEFORE_WORDS_NOTE}\nStingray?`
              : "Stingray?"
        expect(body.messages.at(-1)).toEqual({
          role: "user",
          content: expected,
        })
        expect(history.at(-1)?.text).toBe("Stingray?")
        expect(body.messages[2]).toEqual({ role: "user", content: "Sofia?" })
        if (scenario !== "silent")
          expect(body.messages[3]).toEqual({
            role: "assistant",
            content: "Yep, let me",
          })
      }
    }
  }
)

test("free times come as a picker under the answer, never as buttons too", async () => {
  const days = [
    { date: "2026-10-28", times: [] },
    { date: "2026-10-29", times: ["09:00", "09:15"] },
  ]
  scriptedClient(
    [[toolChunk(0, "call-A", "find_free_times", "{}")], [textChunk("When?")]],
    [judgeOk(["09:00", "09:15"])]
  )
  const { answer, check } = await collectChecked(
    runChat(MESSAGES, CONTEXT, [
      probe(
        async () => ({ service: "Cut", teamMember: null, days }),
        "find_free_times"
      ),
    ])
  )
  // The picker comes with the answer itself, never after the check.
  expect(answer.slice(-2)).toEqual([
    {
      type: "times",
      service: "Cut",
      teamMember: null,
      today: "2026-10-28",
      days,
    },
    { type: "done" },
  ])
  expect(check).toEqual([CHECKED, { type: "done" }])
})

test("no free time at all means no picker", async () => {
  scriptedClient(
    [
      [toolChunk(0, "call-A", "find_free_times", "{}")],
      [textChunk("Nothing free.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(
        async () => ({
          service: "Cut",
          teamMember: null,
          days: [{ date: "2026-10-28", times: [] }],
        }),
        "find_free_times"
      ),
    ])
  )
  expect(events.some((e) => (e as { type: string }).type === "times")).toBe(
    false
  )
})
