// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { createMock, OpenAiMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  OpenAiMock: vi.fn(),
}))

vi.mock("openai", () => ({ default: OpenAiMock }))

const {
  collectTranslatableTexts,
  pendingTranslations,
  translateTexts,
  translationBatches,
  translationId,
} = await import("./translate")

function fresh() {
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  vi.stubEnv("MODEL_API_KEY", "test-key")
}

function reply(items: { id: string; text: string }[]) {
  return { choices: [{ message: { content: JSON.stringify({ items }) } }] }
}

test("returns the model's good answer, trimmed", async () => {
  fresh()
  createMock.mockResolvedValue(
    reply([
      { id: translationId("svc-1", "service.name"), text: "  Corte Clásico " },
    ])
  )
  const got = await translateTexts([
    { id: translationId("svc-1", "service.name"), text: "Classic Cut" },
  ])
  expect(got).toEqual(
    new Map([[translationId("svc-1", "service.name"), "Corte Clásico"]])
  )
  const request = createMock.mock.calls[0]?.[0]
  expect(request.model).toBe("muse-spark-1.3")
  expect(request.response_format.json_schema.strict).toBe(true)
  expect(request.messages[0].content).toMatch(/Latin American Spanish/)
})

test("drops unknown ids and too-long texts without throwing", async () => {
  fresh()
  const nameId = translationId("svc-1", "service.name")
  createMock.mockResolvedValue(
    reply([
      { id: nameId, text: "Corte" },
      { id: "nobody-asked", text: "Hola" },
      { id: translationId("svc-2", "service.name"), text: "x".repeat(81) },
      { id: translationId("svc-3", "service.description"), text: "   " },
    ])
  )
  const got = await translateTexts([
    { id: nameId, text: "Cut" },
    { id: translationId("svc-2", "service.name"), text: "Trim" },
    { id: translationId("svc-3", "service.description"), text: "Wash" },
  ])
  expect(got).toEqual(new Map([[nameId, "Corte"]]))
})

test("returns an empty Map when the call throws", async () => {
  fresh()
  createMock.mockRejectedValueOnce(new Error("boom"))
  const got = await translateTexts([
    { id: translationId("svc-1", "service.name"), text: "Cut" },
  ])
  expect(got).toEqual(new Map())
})

test("returns an empty Map when Meta AI is off and calls nothing", async () => {
  fresh()
  vi.stubEnv("MODEL_API_KEY", "")
  const got = await translateTexts([
    { id: translationId("svc-1", "service.name"), text: "Cut" },
  ])
  expect(got).toEqual(new Map())
  expect(createMock).not.toHaveBeenCalled()
})

test("calls once per batch of at most 40 items", async () => {
  fresh()
  const items = Array.from({ length: 41 }, (_, i) => ({
    id: translationId(`svc-${i}`, "service.name"),
    text: `Service ${i}`,
  }))
  // The user message is a text prefix plus a JSON array; parse from the "[".
  const askedIds = (content: string): string[] =>
    (
      JSON.parse(content.slice(content.indexOf("["))) as {
        id: string
        text: string
      }[]
    ).map((item) => item.id)
  createMock.mockImplementation(async (request: {
    messages: { content: string }[]
  }) => {
    const ids = askedIds(request.messages[1]?.content ?? "[]")
    return reply(ids.map((id) => ({ id, text: "ES" })))
  })
  const got = await translateTexts(items)
  expect(createMock).toHaveBeenCalledTimes(2)
  expect(
    createMock.mock.calls.every(
      (call) => askedIds(call[0].messages[1].content).length <= 40
    )
  ).toBe(true)
  expect(got.size).toBe(41)
})

test("keeps the batches that worked when a later one fails", async () => {
  fresh()
  const items = Array.from({ length: 41 }, (_, i) => ({
    id: translationId(`svc-${i}`, "service.name"),
    text: `Service ${i}`,
  }))
  createMock
    .mockResolvedValueOnce(
      reply(items.slice(0, 40).map((item) => ({ id: item.id, text: "ES" })))
    )
    .mockRejectedValueOnce(new Error("boom"))
  const got = await translateTexts(items)
  expect(got.size).toBe(40)
  expect(got.has(items[40].id)).toBe(false)
})

test("collectTranslatableTexts counts About, names and descriptions", () => {
  const all = collectTranslatableTexts(
    "biz-1",
    "Cozy shop",
    null,
    [
      { id: "svc-1", name: "Cut", description: "A cut" },
      { id: "svc-2", name: "Trim", description: null },
      { id: "svc-3", name: "Wash", description: "" },
    ]
  )
  expect(all.map((item) => [item.entityId, item.field])).toEqual([
    ["biz-1", "business.description"],
    ["svc-1", "service.name"],
    ["svc-1", "service.description"],
    ["svc-2", "service.name"],
    ["svc-3", "service.name"],
  ])
  expect(all[0]?.id).toBe(translationId("biz-1", "business.description"))
})

test("collectTranslatableTexts skips a missing About", () => {
  expect(collectTranslatableTexts("biz-1", null, null, [])).toEqual([])
  expect(
    collectTranslatableTexts("biz-1", "  ", null, [
      { id: "svc-1", name: "Cut", description: null },
    ]).map((item) => item.field)
  ).toEqual(["service.name"])
})

test("collectTranslatableTexts counts each team member's job title and About", () => {
  const all = collectTranslatableTexts(
    "biz-1",
    null,
    null,
    [],
    undefined,
    [
      { id: "tm-1", description: "Barber", about: "Ten years of fades." },
      { id: "tm-2", description: null, about: " " },
      { id: "tm-3", description: null, about: "Color expert." },
    ]
  )
  expect(all.map((item) => [item.entityId, item.field])).toEqual([
    ["tm-1", "team_member.description"],
    ["tm-1", "team_member.about"],
    ["tm-3", "team_member.about"],
  ])
})

test("pendingTranslations keeps only missing or out-of-date texts", () => {
  const all = collectTranslatableTexts(
    "biz-1",
    "Cozy shop",
    null,
    [{ id: "svc-1", name: "Cut", description: "A cut" }]
  )
  expect(pendingTranslations(all, [])).toEqual(all)
  const upToDate = all.map((item) => ({
    entityId: item.entityId,
    field: item.field,
    sourceText: item.text,
  }))
  expect(pendingTranslations(all, upToDate)).toEqual([])
  // One stale source text and one row for another business's same text.
  const existing = upToDate.map((row) =>
    row.field === "service.name"
      ? { ...row, sourceText: "Old name" }
      : row
  )
  const pending = pendingTranslations(all, existing)
  expect(pending.map((item) => item.field)).toEqual(["service.name"])
})

test("collectTranslatableTexts adds each policy that has text", () => {
  const all = collectTranslatableTexts("biz-1", null, null, [], undefined, [], [
    { id: "pol-1", body: "Cancel a day ahead." },
    { id: "pol-2", body: "  " },
  ])
  expect(all).toEqual([
    {
      id: translationId("pol-1", "policy.body"),
      entityId: "pol-1",
      field: "policy.body",
      text: "Cancel a day ahead.",
    },
  ])
})

test("translationBatches splits by count and by length, in order", () => {
  const short = Array.from({ length: 45 }, (_, i) => ({ text: `t${i}` }))
  expect(translationBatches(short).map((batch) => batch.length)).toEqual([40, 5])
  const long = { text: "x".repeat(2500) }
  const batches = translationBatches([{ text: "a" }, long, long, { text: "b" }])
  expect(batches).toEqual([[{ text: "a" }, long], [long, { text: "b" }]])
  // A text over the budget still goes, alone.
  const huge = { text: "x".repeat(4000) }
  expect(translationBatches([huge, { text: "c" }])).toEqual([[huge], [{ text: "c" }]])
})

test("collectTranslatableTexts collects a category next to About", () => {
  expect(collectTranslatableTexts("biz-1", "Cozy shop", "Photography studio", [])).toEqual([
    { id: translationId("biz-1", "business.description"), entityId: "biz-1", field: "business.description", text: "Cozy shop" },
    { id: translationId("biz-1", "business.category"), entityId: "biz-1", field: "business.category", text: "Photography studio" },
  ])
})

test.each([null, "", "   "])("collectTranslatableTexts skips an empty category: %s", (category) => {
  expect(collectTranslatableTexts("biz-1", null, category, [])).toEqual([])
})

test("the prompt treats a category as a short business-type label", async () => {
  fresh()
  const id = translationId("biz-1", "business.category")
  createMock.mockResolvedValue(reply([{ id, text: "Estudio de fotografía" }]))
  expect(await translateTexts([{ id, text: "Photography studio" }])).toEqual(new Map([[id, "Estudio de fotografía"]]))
  const request = createMock.mock.calls[0][0]
  expect(request.messages[0].content).toContain(":business.category")
  expect(request.messages[0].content).toContain("short business-type label, not a business name")
  expect(request.messages[1].content).toContain(JSON.stringify({ id, text: "Photography studio" }))
})
