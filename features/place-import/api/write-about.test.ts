// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { createMock, OpenAiMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  OpenAiMock: vi.fn(),
}))

vi.mock("openai", () => ({ default: OpenAiMock }))

const SYSTEM_MESSAGE =
  "You write the About text for a local business's booking page, as the business speaking to a new customer. Two short sentences, at most 280 characters, warm, friendly and plain English. Say what kind of place it is and where (name only the neighbourhood or city, never the street address or postal code), then invite people in or to book. Use only the facts given. Never invent prices, years, awards, staff, products or claims. Do not list the opening days. No emojis, no hashtags, no quotes."

function reply(about: unknown, category?: unknown) {
  return {
    choices: [{ message: { content: JSON.stringify({ about, category }) } }],
  }
}

async function loadFresh() {
  vi.resetModules()
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  return await import("./write-about")
}

beforeEach(() => {
  vi.stubEnv("MODEL_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
})

test("sends the system message and schema, returns the trimmed text", async () => {
  const { writeAbout } = await loadFresh()
  createMock.mockResolvedValue(
    reply("  A warm little shop. Walk-ins welcome.  ")
  )

  await expect(
    writeAbout({
      name: "Demo Shop",
      category: "Barber shop",
      address: "Av. Churchill, Santo Domingo",
      openingDays: ["Mon", "Tue"],
      amenities: ["wheelchair"],
    })
  ).resolves.toEqual({
    about: "A warm little shop. Walk-ins welcome.",
    category: null,
  })

  expect(createMock).toHaveBeenCalledTimes(1)
  const [params] = createMock.mock.calls[0] as [Record<string, unknown>]
  expect(params.model).toBe("muse-spark-1.3")
  expect(params.messages).toMatchObject([
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: expect.stringContaining("Demo Shop") },
  ])
  expect(params.response_format).toMatchObject({
    type: "json_schema",
    json_schema: {
      name: expect.any(String),
      schema: {
        type: "object",
        properties: { about: { type: "string" } },
        required: ["about"],
      },
    },
  })
})

test("with nameCategory, asks for a category too and checks it", async () => {
  const { writeAbout } = await loadFresh()
  const facts = {
    name: "Boston Photo Studio",
    placeTypes: [],
    website: "https://www.bostonphotostudio.com/book",
    nameCategory: true,
  }
  createMock.mockResolvedValueOnce(
    reply("A photo studio in Boston. Book a session.", " photography  studio ")
  )

  await expect(writeAbout(facts)).resolves.toEqual({
    about: "A photo studio in Boston. Book a session.",
    category: "Photography studio",
  })
  const [params] = createMock.mock.calls[0] as [Record<string, unknown>]
  expect(params.messages).toMatchObject([
    { role: "system", content: expect.stringContaining('"category"') },
    {
      role: "user",
      content: expect.stringContaining("Website: bostonphotostudio.com"),
    },
  ])
  expect(params.response_format).toMatchObject({
    json_schema: { schema: { required: ["about", "category"] } },
  })

  // A catch-all, too many words or odd characters: the About stays, no
  // category.
  for (const bad of ["Services", "A very nice photo studio", "Photo #1", ""]) {
    createMock.mockResolvedValueOnce(reply("A photo studio in Boston.", bad))
    await expect(writeAbout(facts)).resolves.toEqual({
      about: "A photo studio in Boston.",
      category: null,
    })
  }
})

test("returns null on error, empty text and too-long text", async () => {
  const { writeAbout } = await loadFresh()
  const facts = { name: "Demo Shop" }

  createMock.mockRejectedValueOnce(new Error("boom"))
  await expect(writeAbout(facts)).resolves.toBeNull()

  createMock.mockResolvedValueOnce(reply("   "))
  await expect(writeAbout(facts)).resolves.toBeNull()

  createMock.mockResolvedValueOnce(reply("x".repeat(401)))
  await expect(writeAbout(facts)).resolves.toBeNull()

  createMock.mockResolvedValueOnce({ choices: [] })
  await expect(writeAbout(facts)).resolves.toBeNull()
})

test("returns null without calling the API when the key is missing", async () => {
  vi.stubEnv("MODEL_API_KEY", "")
  const { writeAbout } = await loadFresh()

  await expect(writeAbout({ name: "Demo Shop" })).resolves.toBeNull()
  expect(OpenAiMock).not.toHaveBeenCalled()
  expect(createMock).not.toHaveBeenCalled()
})
