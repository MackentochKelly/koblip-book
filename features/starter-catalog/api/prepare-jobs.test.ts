// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  hasCatalog: vi.fn(),
  draftFor: vi.fn(),
  writeCatalog: vi.fn(),
  catalogSummary: vi.fn(),
  policyParts: vi.fn(),
  draftPoliciesFor: vi.fn(),
  writeMissingPolicies: vi.fn(),
}))

vi.mock("@/lib/meta-ai", () => ({ isMetaAiEnabled: () => true }))
vi.mock("./fill-catalog", () => ({
  hasCatalog: mocks.hasCatalog,
  draftFor: mocks.draftFor,
  writeCatalog: mocks.writeCatalog,
  catalogSummary: mocks.catalogSummary,
}))
vi.mock("./fill-policies", () => ({
  policyParts: mocks.policyParts,
  draftPoliciesFor: mocks.draftPoliciesFor,
  writeMissingPolicies: mocks.writeMissingPolicies,
}))

const { catalogJob, policiesJob } = await import("./prepare-jobs")

type Business = Parameters<typeof catalogJob>[0]
let count = 0
const business = () => ({ id: `biz-${++count}`, isDemo: false }) as Business

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.hasCatalog.mockResolvedValue(false)
  mocks.catalogSummary.mockImplementation(async (_b, _role, created) => ({ created }))
})

test("a second caller joins the running catalog job and keeps its result", async () => {
  const biz = business()
  mocks.draftFor.mockResolvedValue({ team: { role: "Photographer" } })
  const first = catalogJob(biz)
  const second = catalogJob(biz)
  expect(second).toBe(first)
  await expect(first).resolves.toEqual({ ok: true, summary: { created: true } })
  // Later, the setup screen still sees that it was just made.
  mocks.hasCatalog.mockResolvedValue(true)
  await expect(catalogJob(biz)).resolves.toEqual({ ok: true, summary: { created: true } })
  expect(mocks.draftFor).toHaveBeenCalledTimes(1)
  expect(mocks.writeCatalog).toHaveBeenCalledTimes(1)
})

test("a failed catalog job is dropped so the next caller tries again", async () => {
  const biz = business()
  mocks.draftFor.mockResolvedValueOnce(null)
  await expect(catalogJob(biz)).resolves.toEqual({ ok: false, error: "failed" })
  mocks.draftFor.mockResolvedValueOnce({ team: { role: "Photographer" } })
  await expect(catalogJob(biz)).resolves.toMatchObject({ ok: true })
  expect(mocks.draftFor).toHaveBeenCalledTimes(2)
})

test("a thrown catalog job is dropped too", async () => {
  const biz = business()
  mocks.draftFor.mockRejectedValueOnce(new Error("boom"))
  await expect(catalogJob(biz)).rejects.toThrow("boom")
  mocks.draftFor.mockResolvedValueOnce({ team: { role: "Photographer" } })
  await expect(catalogJob(biz)).resolves.toMatchObject({ ok: true })
})

test("policies are drafted once for two callers", async () => {
  const biz = business()
  mocks.policyParts.mockResolvedValue({ texts: false, points: false })
  mocks.draftPoliciesFor.mockResolvedValue({ texts: {}, points: [] })
  const [a, b] = await Promise.all([policiesJob(biz), policiesJob(biz)])
  expect(a).toEqual({ ok: true })
  expect(b).toEqual({ ok: true })
  expect(mocks.draftPoliciesFor).toHaveBeenCalledTimes(1)
})
