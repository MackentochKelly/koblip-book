// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

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

test("plain answer sends one text event then done, with tools offered", async () => {
  const { seen } = scriptedClient([[textChunk("Hi"), textChunk("!")]])
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toEqual([
    { type: "text", delta: "Hi" },
    { type: "text", delta: "!" },
    { type: "done" },
  ])
  const body = seen[0] as unknown as {
    tools: { function: { name: string } }[]
    stream: boolean
    reasoning_effort: string
    parallel_tool_calls: boolean
  }
  expect(body.tools.map((t) => t.function.name)).toEqual(["probe"])
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
    { type: "step", id: "call-A", label: "Probing…", status: "done" },
    { type: "step", id: "call-B", label: "Probing…", status: "running" },
    { type: "step", id: "call-B", label: "Probing…", status: "done" },
    { type: "text", delta: "Done." },
    {
      type: "step",
      id: "check-1",
      label: "Checking the answer…",
      status: "running",
    },
    {
      type: "step",
      id: "check-1",
      label: "Checking the answer…",
      status: "done",
    },
    { type: "done" },
  ])
  expect(run).toHaveBeenCalledTimes(2)
  expect(run).toHaveBeenNthCalledWith(1, { a: 1 })
  expect(run).toHaveBeenNthCalledWith(2, {})
})

test("streams pre-tool text and separates later text across empty turns", async () => {
  scriptedClient(
    [
      [textChunk("Checking."), toolChunk(0, "a", "probe", "{}")],
      [toolChunk(0, "b", "probe", "{}")],
      [textChunk("Two"), textChunk(" bookings.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
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

const { peekPendingAction, resetPendingActionsForTests } =
  await import("./pending-actions")

function risky(describe: (args: unknown) => Promise<unknown>) {
  return {
    definition: {
      name: "cancel_booking",
      description: "Cancel a booking. Needs the owner's tap.",
      parameters: {},
      needsConfirm: true,
    },
    label: "Cancelling…",
    run: async () => ({ error: "needs tap" }),
    confirm: {
      describe: describe as (args: unknown) => Promise<
        | {
            title: string
            summary: string
            destructive: boolean
            action: string
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
  expect(peekPendingAction(id)?.toolName).toBe("cancel_booking")
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
  expect(events).toEqual([
    { type: "text", delta: "Hi" },
    { type: "text", delta: "!" },
    { type: "done" },
  ])
  expect(judgeBodies(create)).toEqual([])
})

test("tool then supported answer comes after a checking step", async () => {
  const { create } = scriptedClient(
    [
      [toolChunk(0, "call-A", "probe", "{}")],
      [textChunk("You have 2 bookings.")],
    ],
    [judgeOk()]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({ today: 2 }))])
  )
  expect(events).toEqual([
    { type: "step", id: "call-A", label: "Probing…", status: "running" },
    { type: "step", id: "call-A", label: "Probing…", status: "done" },
    { type: "text", delta: "You have 2 bookings." },
    {
      type: "step",
      id: "check-1",
      label: "Checking the answer…",
      status: "running",
    },
    {
      type: "step",
      id: "check-1",
      label: "Checking the answer…",
      status: "done",
    },
    { type: "done" },
  ])
  expect(judgeBodies(create)).toHaveLength(1)
})

test("unknown judge verdict sends the answer marked unverified", async () => {
  scriptedClient(
    [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("2 bookings.")]],
    ["not json"]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [probe(async () => ({}))])
  )
  expect(events).toContainEqual({ type: "text", delta: "2 bookings." })
  expect(events).toContainEqual({ type: "notice", kind: "unverified" })
  const checkSteps = events.filter(
    (e) =>
      (e as { type: string }).type === "step" &&
      (e as { id: string }).id.startsWith("check-")
  )
  expect(checkSteps.map((e) => (e as { status: string }).status)).toEqual([
    "running",
    "failed",
  ])
  expect(events.some((e) => (e as { type: string }).type === "choices")).toBe(
    false
  )
  expect(events[events.length - 1]).toEqual({ type: "done" })
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

test("judge choices from the tool results send text, buttons, done", async () => {
  scriptedClient(
    [
      [toolChunk(0, "call-A", "probe", "{}")],
      [textChunk("Which one: Classic Haircut or Skin Fade?")],
    ],
    [judgeOk(["Classic Haircut", "Skin Fade"])]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({
        services: [{ name: "Classic Haircut" }, { name: "Skin Fade" }],
      })),
    ])
  )
  expect(events).toEqual([
    { type: "step", id: "call-A", label: "Probing…", status: "running" },
    { type: "step", id: "call-A", label: "Probing…", status: "done" },
    { type: "text", delta: "Which one: Classic Haircut or Skin Fade?" },
    {
      type: "step",
      id: "check-1",
      label: "Checking the answer…",
      status: "running",
    },
    {
      type: "step",
      id: "check-1",
      label: "Checking the answer…",
      status: "done",
    },
    { type: "choices", options: ["Classic Haircut", "Skin Fade"] },
    { type: "done" },
  ])
})

test("a choice missing from the tool results is dropped", async () => {
  scriptedClient(
    [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("Which one?")]],
    [judgeOk([" Cut ", "Cut", "Nope", "x".repeat(61), "Fade"])]
  )
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: [{ name: "Cut" }, { name: "Fade" }] })),
    ])
  )
  expect(events).toContainEqual({
    type: "choices",
    options: ["Cut", "Fade"],
  })
})

test("fewer than 2 valid choices send the answer with no buttons", async () => {
  for (const choices of [["Cut"], ["Nope"], [], ["Cut", "Cut"]]) {
    scriptedClient(
      [[toolChunk(0, "call-A", "probe", "{}")], [textChunk("Just Cut.")]],
      [judgeOk(choices)]
    )
    const events = await collect(
      runChat(MESSAGES, CONTEXT, [
        probe(async () => ({ services: [{ name: "Cut" }] })),
      ])
    )
    expect(events).toContainEqual({ type: "text", delta: "Just Cut." })
    expect(events.some((e) => (e as { type: string }).type === "choices")).toBe(
      false
    )
    expect(events[events.length - 1]).toEqual({ type: "done" })
  }
})

function services(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `Cut ${i}` }))
}

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
    "step",
    "step",
    "sources",
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
  const unverified = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: services(2) }), "list_services"),
    ])
  )
  expect(unverified).toContainEqual({ type: "notice", kind: "unverified" })
  expect(
    unverified.some((e) => (e as { type: string }).type === "sources")
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

test("voice uses minimal reasoning, skips judge and sends sources then done", async () => {
  const { create } = scriptedClient([
    [textChunk("Checking."), toolChunk(0, "a", "list_bookings", "{}")],
    [textChunk("Two bookings.")],
  ])
  const events = await collect(
    runChat(MESSAGES, { ...CONTEXT, voice: true }, [
      probe(async () => ({ bookings: [{}, {}] }), "list_bookings"),
    ])
  )
  expect(create).toHaveBeenCalledTimes(2)
  for (const [body] of create.mock.calls)
    expect(body).toMatchObject({ reasoning_effort: "minimal" })
  expect(judgeBodies(create)).toEqual([])
  expect(events).not.toContainEqual(
    expect.objectContaining({ id: expect.stringMatching(/^check-/) })
  )
  expect(events.some((e) => (e as { type: string }).type === "choices")).toBe(
    false
  )
  expect(events.slice(-2)).toEqual([
    { type: "sources", items: [{ kind: "bookings", count: 2 }] },
    { type: "done" },
  ])
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
  const gen = runChat(MESSAGES, CONTEXT, [])
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
  const events = await collect(
    runChat(MESSAGES, CONTEXT, [
      probe(async () => ({ services: [{}] }), "list_services"),
    ])
  )
  expect(create).toHaveBeenCalledTimes(3)
  expect(events.slice(-3)).toEqual([
    { type: "sources", items: [{ kind: "services", count: 1 }] },
    { type: "notice", kind: "unverified" },
    { type: "done" },
  ])
  expect(
    events.findIndex((e) => (e as { type: string }).type === "text")
  ).toBeLessThan(
    events.findIndex((e) => (e as { id?: string }).id === "check-1")
  )
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
