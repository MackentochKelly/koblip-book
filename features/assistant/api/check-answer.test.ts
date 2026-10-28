// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { checkAnswer } = await import("./check-answer")
const meta = await import("@/lib/meta-ai")
const { ASSISTANT_RULES } = await import("@/lib/assistant-rules")

const INPUT = {
  question: "how many bookings today?",
  toolResults: ['{"data":{"todayBookings":2}}'],
  answer: "You have 2 bookings today.",
}

function mockCreate(content: string) {
  const create = vi.fn(async () => ({
    choices: [{ message: { content } }],
  }))
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: { completions: { create } },
  } as never)
  return create
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test("judge call uses json_schema with strict true and low reasoning", async () => {
  const create = mockCreate('{"supported":true,"problems":[]}')
  await expect(checkAnswer(INPUT)).resolves.toEqual({ ok: true })
  const body = (create.mock.calls as unknown[][])[0]?.[0] as {
    model: string
    stream?: boolean
    reasoning_effort: string
    response_format: {
      type: string
      json_schema: {
        name: string
        strict: boolean
        schema: {
          type: string
          additionalProperties: boolean
          properties: Record<string, unknown>
          required: string[]
        }
      }
    }
  }
  expect(body.response_format.type).toBe("json_schema")
  expect(body.response_format.json_schema.name).toBe("answer_check")
  expect(body.response_format.json_schema.strict).toBe(true)
  const schema = body.response_format.json_schema.schema
  expect(schema.additionalProperties).toBe(false)
  expect(schema.required).toEqual(
    expect.arrayContaining(["supported", "problems"])
  )
  expect(Object.keys(schema.properties)).toEqual(
    expect.arrayContaining(schema.required)
  )
  expect(body.reasoning_effort).toBe("low")
  expect(body.stream).not.toBe(true)
})

test("unsupported answers come back with each problem", async () => {
  mockCreate('{"supported":false,"problems":["Wrong count.","Wrong name."]}')
  await expect(checkAnswer(INPUT)).resolves.toEqual({
    ok: false,
    problems: ["Wrong count.", "Wrong name."],
  })
})

test("a failing call is unknown and never throws", async () => {
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: {
      completions: { create: vi.fn(async () => Promise.reject(new Error("down"))) },
    },
  } as never)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    await expect(checkAnswer(INPUT)).resolves.toEqual({ ok: "unknown" })
    expect(error).toHaveBeenCalledWith("answer-check-failed")
  } finally {
    error.mockRestore()
  }
})

test("bad JSON is unknown", async () => {
  const create = mockCreate("not json")
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    await expect(checkAnswer(INPUT)).resolves.toEqual({ ok: "unknown" })
    expect(create).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith("answer-check-failed")
  } finally {
    error.mockRestore()
  }
})

test("a hanging call times out as unknown", async () => {
  vi.useFakeTimers()
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue({
    chat: {
      completions: { create: vi.fn(async () => new Promise(() => {})) },
    },
  } as never)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    const pending = checkAnswer(INPUT)
    await vi.advanceTimersByTimeAsync(ASSISTANT_RULES.answerCheckTimeoutMs)
    await expect(pending).resolves.toEqual({ ok: "unknown" })
    expect(error).toHaveBeenCalledWith("answer-check-failed")
  } finally {
    error.mockRestore()
  }
})

test("no client is unknown", async () => {
  vi.spyOn(meta, "getMetaAiClient").mockReturnValue(null)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    await expect(checkAnswer(INPUT)).resolves.toEqual({ ok: "unknown" })
    expect(error).toHaveBeenCalledWith("answer-check-failed")
  } finally {
    error.mockRestore()
  }
})
