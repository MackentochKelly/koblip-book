// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
// The loop only stores cards; the store itself (the database) has its own
// tests in pending-actions.test.ts.
vi.mock("./pending-actions", () => {
  type Card = {
    id: string
    ownerId: string
    businessId: string
    toolName: string
    args: unknown
  }
  const cards = new Map<string, Card>()
  return {
    storePendingAction: vi.fn(async (input: Omit<Card, "id">) => {
      const id = crypto.randomUUID()
      cards.set(id, { id, ...input })
      return { id }
    }),
    peekPendingAction: vi.fn(async (id: string) => cards.get(id) ?? null),
    takePendingAction: vi.fn(
      async (id: string, ownerId: string, businessId: string) => {
        const card = cards.get(id)
        if (!card) return "expired"
        if (card.ownerId !== ownerId || card.businessId !== businessId) {
          return "not_allowed"
        }
        cards.delete(id)
        return card
      }
    ),
    resetPendingActionsForTests: () => cards.clear(),
  }
})
vi.mock("./audit-log", () => ({ logAssistantAction: vi.fn() }))

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
function scriptedClient(turns: unknown[][]) {
  const seen: {
    messages: {
      role: string
      tool_call_id?: string
      tool_calls?: { id: string }[]
    }[]
  }[] = []
  let n = 0
  const create = vi.fn(async (body: { messages: never[] }) => {
    seen.push(body as never)
    const chunks = turns[Math.min(n, turns.length - 1)]
    n += 1
    return (async function* () {
      for (const c of chunks) {
        yield c
      }
    })()
  })
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  return { seen, create }
}

async function collect(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const events: unknown[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
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
  expect(body.tools.map((t) => t.function.name)).toEqual([
    "probe",
    "ask_owner",
    "confirm_card",
  ])
  expect(body.stream).toBe(true)
  expect(body.reasoning_effort).toBe("low")
  expect(body.parallel_tool_calls).toBe(false)
})

test("tool call then final answer, ids matched in order", async () => {
  const run = vi.fn(async (args: unknown) => ({ echo: args }))
  scriptedClient([
    [
      toolChunk(0, "call-A", "pro", '{"a"'),
      toolChunk(0, undefined, "be", ":1}"),
      toolChunk(1, "call-B", "probe", "{}"),
    ],
    [textChunk("Done.")],
  ])
  const events = await collect(runChat(MESSAGES, CONTEXT, [probe(run)]))
  expect(events).toEqual([
    { type: "step", id: "call-A", label: "Probing…", status: "running" },
    { type: "step", id: "call-A", label: "Probed", status: "done" },
    { type: "step", id: "call-B", label: "Probing…", status: "running" },
    { type: "step", id: "call-B", label: "Probed", status: "done" },
    { type: "text", delta: "Done." },
    { type: "done" },
  ])
  expect(run).toHaveBeenCalledTimes(2)
  expect(run).toHaveBeenNthCalledWith(1, { a: 1 })
  expect(run).toHaveBeenNthCalledWith(2, {})
})

test("talking never says words written before a lookup", async () => {
  scriptedClient([
    [
      textChunk("I need to write nothing before read-only lookups. "),
      textChunk("So I must call tool without text."),
      toolChunk(0, "a", "probe", "{}"),
    ],
    [textChunk("Checking extras."), toolChunk(0, "b", "probe", "{}")],
    [textChunk("Two bookings.")],
  ])
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, [probe(async () => ({}))])
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [{ type: "text", delta: "Two bookings." }]
  )
})

test("talking says a short direct answer whole", async () => {
  scriptedClient([[textChunk("Two"), textChunk(" bookings.")]])
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, [])
  )
  expect(events).toEqual([
    { type: "text", delta: "Two bookings." },
    { type: "done" },
  ])
})

test("typed: words written before a tool call never show", async () => {
  scriptedClient([
    [
      textChunk("Booking flow needs a lookup."),
      toolChunk(0, "a", "probe", "{}"),
    ],
    [textChunk("Two"), textChunk(" bookings.")],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [{ type: "text", delta: "Two bookings." }]
  )
})

test("typed: a long answer streams once enough words and a sentence have come", async () => {
  const first = "x".repeat(ASSISTANT_RULES.holdChars) + ". "
  scriptedClient([
    [textChunk(first), textChunk("Ana at 3"), textChunk(" and Leo.")],
  ])
  const events = await collect(runChat(MESSAGES, CONTEXT, []))
  expect(events).toEqual([
    { type: "text", delta: first + "Ana at 3" },
    { type: "text", delta: " and Leo." },
    { type: "done" },
  ])
})

test("typed: two short sentences before a tool call never show", async () => {
  scriptedClient([
    [
      textChunk("Which service? "),
      textChunk("I'll fetch the options."),
      toolChunk(0, "a", "probe", "{}"),
    ],
    [textChunk("Two bookings.")],
  ])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [{ type: "text", delta: "Two bookings." }]
  )
})

test("second model call carries full assistant message plus ordered tool results", async () => {
  const { create } = scriptedClient([
    [
      toolChunk(0, "call-A", "probe", '{"a":1}'),
      toolChunk(1, "call-B", "probe", "{}"),
    ],
    [textChunk("ok")],
  ])
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
  scriptedClient([[toolChunk(0, "call-A", "probe", "{}")], [textChunk("ok")]])
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
  const { create } = scriptedClient([
    [toolChunk(0, "call-A", "probe", "{}")],
    [textChunk("Can't yet.")],
  ])
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
  expect(second.messages.find((m) => m.role === "tool")?.content).toContain(
    "that booking hasn't happened yet"
  )
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
  scriptedClient([
    [toolChunk(0, "call-A", "list_bookings", '{"day":"today"}')],
    [textChunk("Ana at 10, Leo at 11.")],
  ])
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
    delta: expect.stringContaining("demasiados pasos"),
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

test("no tool means one text event", async () => {
  scriptedClient([[textChunk("Hi"), textChunk("!")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toEqual([{ type: "text", delta: "Hi!" }, { type: "done" }])
})

test("confirm card comes from the tool call", async () => {
  resetPendingActionsForTests()
  scriptedClient([
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
})

const askChunk = (question: string, options: string[]) =>
  toolChunk(0, "call-Q", "ask_owner", JSON.stringify({ question, options }))

test("ask_owner sends the question and its buttons at once", async () => {
  scriptedClient([
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
})

test("a question the model wrote with the call is not asked twice", async () => {
  const turns = [
    [toolChunk(0, "call-A", "probe", "{}")],
    [
      textChunk("Which service would you like?"),
      askChunk("Which service?", ["Cut", "Fade"]),
    ],
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
  // Talking holds them the same way: the question is said once.
  scriptedClient(turns)
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, tools)
  )
  expect(events.filter((e) => (e as { type: string }).type === "text")).toEqual(
    [{ type: "text", delta: "Which service?" }]
  )
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
    expect(
      events.filter((e) => (e as { type: string }).type === "text")
    ).toEqual([{ type: "text", delta: "Which one?" }])
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
    const { seen } = scriptedClient([
      [toolChunk(0, "call-A", "probe", "{}")],
      [toolChunk(0, "call-Q", "ask_owner", args)],
      [textChunk("Cut or Fade?")],
    ])
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [
        probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
      ])
    )
    expect(events.some((e) => (e as { type: string }).type === "choices")).toBe(
      false
    )
    expect(events.slice(-2)).toEqual([
      { type: "text", delta: "Cut or Fade?" },
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
    scriptedClient([
      [toolChunk(0, "call-A", "probe", "{}")],
      [
        askChunk(
          "Which one?",
          list.map((s) => s.name)
        ),
      ],
      [textChunk("There are many, which one?")],
    ])
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
    [textChunk("Let me check."), toolChunk(0, "call-A", "probe", "{}")],
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
  expect(body.tools.map((t) => t.function.name)).toEqual([
    "probe",
    "ask_owner",
    "confirm_card",
  ])
  expect(body.messages[0].content).toContain("ask_owner")
  expect(events.slice(-3)).toEqual([
    { type: "text", delta: "Cut, Fade, or something else?" },
    { type: "choices", options: ["Cut", "Fade"] },
    { type: "done" },
  ])
})

test("sources follow a passed answer with kinds and counts", async () => {
  scriptedClient([
    [
      toolChunk(0, "call-A", "list_services", "{}"),
      toolChunk(1, "call-B", "list_bookings", "{}"),
    ],
    [textChunk("Here they are.")],
  ])
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
  scriptedClient([
    [
      toolChunk(0, "call-A", "list_services", "{}"),
      toolChunk(1, "call-B", "list_services", "{}"),
      toolChunk(2, "call-C", "list_team", "{}"),
      toolChunk(3, "call-D", "find_free_times", "{}"),
    ],
    [textChunk("Done.")],
  ])
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

test("no sources after a confirm card", async () => {
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

test("voice uses minimal reasoning", async () => {
  const { create } = scriptedClient([
    [textChunk("Checking."), toolChunk(0, "a", "list_bookings", "{}")],
    [textChunk("Ana or Leo?")],
  ])
  const voice = { ...CONTEXT, voice: true }
  const tools = [
    probe(
      async () => ({ bookings: [{ name: "Ana" }, { name: "Leo" }] }),
      "list_bookings"
    ),
  ]
  const answer = await collect(runChat(MESSAGES, voice, tools))
  for (const [body] of create.mock.calls.slice(0, 2))
    expect(body).toMatchObject({ reasoning_effort: "minimal" })
  expect(answer.slice(-2)).toEqual([
    { type: "sources", items: [{ kind: "bookings", count: 2 }] },
    { type: "done" },
  ])
})

test("voice gets the time picker too", async () => {
  scriptedClient([
    [toolChunk(0, "a", "find_free_times", "{}")],
    [textChunk("At nine?")],
  ])
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
  const first = "x".repeat(ASSISTANT_RULES.holdChars) + ". Then"
  let advanced = false
  const create = vi.fn(async () =>
    (async function* () {
      yield textChunk(first)
      advanced = true
      yield textChunk(" second")
    })()
  )
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  // Once enough words and a sentence have come, talking streams at once.
  const gen = runChat(MESSAGES, { ...CONTEXT, voice: true }, [])
  expect(await gen.next()).toEqual({
    value: { type: "text", delta: first },
    done: false,
  })
  expect(advanced).toBe(false)
  await collect(gen)
})

test.each([false, true])(
  "empty final answer after tools stops, voice=%s",
  async (voice) => {
    const { create } = scriptedClient([[toolChunk(0, "a", "probe", "{}")], []])
    const events = await collect(
      runChat(MESSAGES, { ...CONTEXT, voice }, [probe(async () => ({}))])
    )
    expect(create).toHaveBeenCalledTimes(2)
    expect(events.slice(-2)).toEqual([
      { type: "text", delta: expect.stringContaining("too many steps") },
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
  scriptedClient([
    [toolChunk(0, "call-A", "find_free_times", "{}")],
    [textChunk("When?")],
  ])
  const answer = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(
        async () => ({ service: "Cut", teamMember: null, days }),
        "find_free_times"
      ),
    ])
  )
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
})

test("no free time at all means no picker", async () => {
  scriptedClient([
    [toolChunk(0, "call-A", "find_free_times", "{}")],
    [textChunk("Nothing free.")],
  ])
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

// A card shown in the last answer, then the owner's words about it.
async function shownCard(
  execute = vi.fn(async () => ({ ok: true, doneText: "Booked." }))
) {
  resetPendingActionsForTests()
  const { storePendingAction } = await import("./pending-actions")
  const { id } = (await storePendingAction({
    ownerId: "u1",
    businessId: "b1",
    toolName: "cancel_booking",
    args: { bookingId: "k1" },
  })) as { id: string }
  const tool = risky(async () => ({
    title: "Cancel?",
    summary: "Ana",
    destructive: true,
    action: "Cancel booking",
  }))
  tool.confirm.execute = execute
  const messages = [
    { role: "owner" as const, text: "Cancel Ana" },
    { role: "assistant" as const, text: "", waiting: id },
    { role: "owner" as const, text: "Yes, I confirm" },
  ]
  return { id, tool, execute, messages }
}

test("the waiting card is noted for the model, never sent as empty words", async () => {
  const { tool, messages } = await shownCard()
  const { seen } = scriptedClient([[textChunk("Tap the button.")]])
  await collect(runChat(messages, CONTEXT, [tool]))
  const sent = seen[0].messages as unknown as {
    role: string
    content: string
  }[]
  const tail = sent.slice(-2)
  expect(tail[0].role).toBe("developer")
  expect(tail[0].content).toContain(
    'still waiting for the owner\'s tap: cancel_booking {"bookingId":"k1"}'
  )
  expect(tail[0].content).toContain("Never make this card again")
  expect(tail[1]).toEqual({ role: "user", content: "Yes, I confirm" })
  expect(sent.some((m) => m.role === "assistant" && m.content === "")).toBe(
    false
  )
})

test("a yes in words runs the waiting card like a tap, once", async () => {
  const { id, tool, execute, messages } = await shownCard()
  const { create } = scriptedClient([
    [toolChunk(0, "c1", "confirm_card", "{}")],
  ])
  const events = await collect(runChat(messages, CONTEXT, [tool]))
  expect(execute).toHaveBeenCalledWith({ bookingId: "k1" })
  expect(events).toEqual([
    { type: "accepted", id },
    expect.objectContaining({ type: "step", status: "running" }),
    expect.objectContaining({ type: "step", status: "done" }),
    { type: "result", ok: true, text: "Booked.", kind: "bookings" },
    { type: "done" },
  ])
  expect(create).toHaveBeenCalledTimes(1)
  expect(await peekPendingAction(id)).toBeNull()
})

test("confirm_card with no card waiting runs nothing and goes back to the model", async () => {
  const { tool, execute } = await shownCard()
  const { seen } = scriptedClient([
    [toolChunk(0, "c1", "confirm_card", "{}")],
    [textChunk("Which booking?")],
  ])
  const events = await collect(runChat(MESSAGES, CONTEXT, [tool]))
  expect(execute).not.toHaveBeenCalled()
  expect(events.at(-1)).toEqual({ type: "done" })
  const reply = seen[1].messages.at(-1) as unknown as {
    role: string
    content: string
  }
  expect(reply.role).toBe("tool")
  expect(reply.content).toContain("no card is waiting")
})

test("only the card shown right before the owner's words can be confirmed", async () => {
  const { tool, execute, messages } = await shownCard()
  scriptedClient([
    [toolChunk(0, "c1", "confirm_card", "{}")],
    [textChunk("Okay.")],
  ])
  // Another answer came after the card: it no longer counts.
  await collect(
    runChat(
      [
        ...messages.slice(0, 2),
        { role: "assistant", text: "Anything else?" },
        messages[2],
      ],
      CONTEXT,
      [tool]
    )
  )
  expect(execute).not.toHaveBeenCalled()
})

test("another owner's card is never noted or run", async () => {
  const { tool, execute, messages } = await shownCard()
  const { seen } = scriptedClient([
    [toolChunk(0, "c1", "confirm_card", "{}")],
    [textChunk("Okay.")],
  ])
  await collect(runChat(messages, { ...CONTEXT, ownerId: "u2" }, [tool]))
  expect(execute).not.toHaveBeenCalled()
  const sent = seen[0].messages as unknown as { content: string }[]
  expect(
    sent.some((m) => String(m.content).includes("still waiting for the owner"))
  ).toBe(false)
})
