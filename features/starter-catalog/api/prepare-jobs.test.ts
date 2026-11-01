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
  drawMemberPhoto: vi.fn(),
}))

vi.mock("@/lib/meta-ai", () => ({ isMetaAiEnabled: () => true }))
vi.mock("./fill-catalog", () => ({
  hasCatalog: mocks.hasCatalog,
  draftFor: mocks.draftFor,
  writeCatalog: mocks.writeCatalog,
  catalogSummary: mocks.catalogSummary,
  drawMemberPhoto: mocks.drawMemberPhoto,
}))
vi.mock("./fill-policies", () => ({
  policyParts: mocks.policyParts,
  draftPoliciesFor: mocks.draftPoliciesFor,
  writeMissingPolicies: mocks.writeMissingPolicies,
}))

const { catalogJob, photoJob, policiesJob, startPreparing } = await import(
  "./prepare-jobs"
)

type Business = Parameters<typeof catalogJob>[0]
let count = 0
const business = () =>
  ({ id: `biz-${++count}`, isDemo: false, setupFinishedAt: null, ownerId: "owner-1" }) as Business

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
  // Later, the setup screen still knows setup is unfinished.
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

test("a team photo is drawn once and shared with the setup screen", async () => {
  const biz = business()
  mocks.drawMemberPhoto.mockResolvedValue("/photos/a.webp")
  const early = photoJob(biz, "tm-1")
  await expect(photoJob(biz, "tm-1")).resolves.toEqual({
    ok: true,
    photoUrl: "/photos/a.webp",
  })
  await early
  expect(mocks.drawMemberPhoto).toHaveBeenCalledTimes(1)
  expect(mocks.drawMemberPhoto).toHaveBeenCalledWith(biz, "tm-1", "owner-1")
})

test("startPreparing draws the new team and translates after the texts", async () => {
  const biz = business()
  const order: string[] = []
  mocks.draftFor.mockResolvedValue({ team: { role: "Photographer" } })
  mocks.catalogSummary.mockResolvedValue({
    created: true,
    team: [{ id: "tm-1" }, { id: "tm-2" }],
  })
  mocks.writeCatalog.mockImplementation(async () => {
    order.push("catalog")
  })
  mocks.policyParts.mockResolvedValue({ texts: false, points: false })
  mocks.draftPoliciesFor.mockResolvedValue({ texts: {}, points: [] })
  mocks.writeMissingPolicies.mockImplementation(async () => {
    order.push("policies")
  })
  mocks.drawMemberPhoto.mockResolvedValue("/photos/a.webp")
  await startPreparing(biz, async () => {
    order.push("spanish")
  })
  expect(order.at(-1)).toBe("spanish")
  expect(order).toContain("catalog")
  expect(order).toContain("policies")
  expect(mocks.drawMemberPhoto).toHaveBeenCalledTimes(2)
})

test("startPreparing leaves demo copies alone", async () => {
  const translate = vi.fn()
  await startPreparing({ ...business(), isDemo: true } as Business, translate)
  expect(translate).not.toHaveBeenCalled()
  expect(mocks.draftFor).not.toHaveBeenCalled()
})

test("saved setup resumes its rows, missing photos and Spanish after the store is cleared", async () => {
  const biz = business()
  mocks.draftFor.mockResolvedValue({ team: { role: "Photographer" } })
  mocks.catalogSummary.mockImplementation(async (_b, _role, created) => ({
    created,
    team: [{ id: "tm-1", photoUrl: null }, { id: "tm-2", photoUrl: "/photos/existing.webp" }],
  }))
  await catalogJob(biz)
  ;(globalThis as typeof globalThis & { koblipPrepareJobs?: Map<string, Promise<unknown>> }).koblipPrepareJobs?.clear()
  mocks.hasCatalog.mockResolvedValue(true)
  mocks.policyParts.mockResolvedValue({ texts: true, points: true })
  mocks.drawMemberPhoto.mockResolvedValue("/photos/a.webp")
  const translate = vi.fn(async () => {})

  await expect(catalogJob(biz)).resolves.toMatchObject({ ok: true, summary: { created: true } })
  await startPreparing(biz, translate)

  expect(mocks.writeCatalog).toHaveBeenCalledTimes(1)
  expect(mocks.draftFor).toHaveBeenCalledTimes(1)
  expect(mocks.drawMemberPhoto).toHaveBeenCalledExactlyOnceWith(biz, "tm-1", "owner-1")
  expect(translate).toHaveBeenCalledTimes(1)
})

test("finished setup ignores even a cached unfinished catalog and starts nothing", async () => {
  const biz = business()
  mocks.draftFor.mockResolvedValue({ team: { role: "Photographer" } })
  await catalogJob(biz)
  const finished = { ...biz, setupFinishedAt: 123 }
  const translate = vi.fn()
  await expect(catalogJob(finished)).resolves.toMatchObject({ ok: true, summary: { created: false } })
  await startPreparing(finished, translate)
  expect(mocks.draftFor).toHaveBeenCalledTimes(1)
  expect(mocks.drawMemberPhoto).not.toHaveBeenCalled()
  expect(mocks.policyParts).not.toHaveBeenCalled()
  expect(translate).not.toHaveBeenCalled()
})

test("failed background work and translation never throw", async () => {
  mocks.draftFor.mockRejectedValue(new Error("catalog"))
  mocks.policyParts.mockRejectedValue(new Error("policies"))
  await expect(startPreparing(business(), async () => { throw new Error("Spanish") })).resolves.toBeUndefined()
})
