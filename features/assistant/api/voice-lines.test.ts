// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const create = vi.fn()
vi.mock("@/lib/meta-ai", () => ({
  META_TALK_MODEL: "model",
  getMetaAiClient: vi.fn(() => ({ chat: { completions: { create } } })),
}))

const { getMetaAiClient } = await import("@/lib/meta-ai")
const { VOICE_RULES } = await import("@/lib/voice-rules")
const { writeGreeting, writeCutIns } = await import("./voice-lines")

const CONTEXT = {
  businessName: "Salon",
  timeZone: "Europe/Madrid",
  now: Date.UTC(2026, 9, 28, 9, 0, 0),
  language: "en" as const,
}

const answers = (content: unknown) =>
  create.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  })

const promptOf = () =>
  (create.mock.calls[0][0] as { messages: { content: string }[] }).messages[0]
    .content

beforeEach(() => {
  create.mockReset()
})

test("the hello comes from the model, asked in the owner's language", async () => {
  answers({ greeting: " Hi, it's Koblip. What do you need? " })
  await expect(writeGreeting(CONTEXT)).resolves.toBe(
    "Hi, it's Koblip. What do you need?"
  )
  expect(promptOf()).toContain("Koblip")
  expect(promptOf()).toContain('"Salon"')
  expect(promptOf()).toContain("English")
  create.mockReset()
  answers({ greeting: "Hola" })
  await writeGreeting({ ...CONTEXT, language: "es" })
  expect(promptOf()).toContain("Spanish")
  create.mockReset()
  answers({ greeting: "Olá" })
  await writeGreeting({ ...CONTEXT, language: "pt" })
  expect(promptOf()).toContain("Write in Brazilian Portuguese, using você")
  create.mockReset()
  answers({ greeting: "Bonjour" })
  await writeGreeting({ ...CONTEXT, language: "fr" })
  expect(promptOf()).toContain("Write in French, using vous")
})

test("a hello too long, empty, or not JSON is no hello", async () => {
  answers({ greeting: "x".repeat(VOICE_RULES.voiceLineMaxChars.greeting + 1) })
  await expect(writeGreeting(CONTEXT)).resolves.toBeNull()
  answers({ greeting: " " })
  await expect(writeGreeting(CONTEXT)).resolves.toBeNull()
  answers('{"greet')
  await expect(writeGreeting(CONTEXT)).resolves.toBeNull()
})

test("cut-in words keep only usable ones, each once", async () => {
  answers({
    cutIns: [
      "Oh,",
      "oh,",
      " Right, ",
      "",
      7,
      "x".repeat(VOICE_RULES.voiceLineMaxChars.cutIn + 1),
    ],
  })
  await expect(writeCutIns(CONTEXT)).resolves.toEqual({
    cutIns: ["Oh,", "Right,"],
  })
})

test("never more cut-in words than asked for", async () => {
  answers({ cutIns: Array.from({ length: 40 }, (_, i) => `W${i},`) })
  const lines = await writeCutIns(CONTEXT)
  expect(lines?.cutIns).toHaveLength(VOICE_RULES.voiceLineCounts.cutIns)
})

test("the budget leaves room past the model's reasoning", async () => {
  answers({ cutIns: [] })
  await writeCutIns(CONTEXT)
  expect(create.mock.calls[0][0]).toMatchObject({
    max_completion_tokens: VOICE_RULES.voiceLinesMaxTokens,
  })
})

test("a failed call or no AI gives nothing, and never throws", async () => {
  create.mockRejectedValueOnce(new Error("down"))
  await expect(writeCutIns(CONTEXT)).resolves.toBeNull()
  create.mockRejectedValueOnce(new Error("down"))
  await expect(writeGreeting(CONTEXT)).resolves.toBeNull()
  vi.mocked(getMetaAiClient).mockReturnValueOnce(null)
  await expect(writeGreeting(CONTEXT)).resolves.toBeNull()
})
