import { cleanup, render as renderUi, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { WithWords } from "@/i18n/testing"

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  policies: vi.fn(),
  photo: vi.fn(),
  finish: vi.fn(),
  replace: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock("next/image", () => ({ default: () => null }))
vi.mock("@/components/step-reveal", () => ({ StepReveal: () => null }))
vi.mock("@/lib/pace", () => ({
  atLeast: async (work: Promise<unknown>) => work,
  pause: async () => {},
}))
vi.mock("../api/prepare-actions", () => ({
  startStarterCatalog: mocks.catalog,
  startPolicies: mocks.policies,
  drawTeamPhoto: mocks.photo,
  finishSetup: mocks.finish,
}))
const { PreparingCard } = await import("./preparing-card")

const render = (ui: React.ReactElement) => renderUi(ui, { wrapper: WithWords })

afterEach(cleanup)
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.policies.mockResolvedValue({ ok: true })
  mocks.photo.mockResolvedValue({ ok: true, photoUrl: "/photo.webp" })
  mocks.finish.mockResolvedValue({ ok: true })
})

test("saved setup draws only missing photos and finishes before ready, without waiting for Spanish", async () => {
  mocks.catalog.mockResolvedValue({ ok: true, summary: {
    created: true, currency: "USD", services: [], extras: [], role: null,
    team: [{ id: "missing", name: "Ana", photoUrl: null }, { id: "saved", name: "Luis", photoUrl: "/saved.webp" }],
  } })
  const order: string[] = []
  mocks.policies.mockImplementation(async () => { order.push("policies"); return { ok: true } })
  mocks.finish.mockImplementation(async () => { order.push("finish"); return { ok: true } })
  mocks.replace.mockImplementation(() => { order.push("ready") })
  render(<PreparingCard businessId="biz" language="en" readyHref="/ready" />)
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/ready"))
  expect(mocks.photo).toHaveBeenCalledExactlyOnceWith("biz", "missing")
  expect(order).toEqual(["policies", "finish", "ready"])
})

for (const error of ["ai_off", "failed"]) {
  test(`${error} still finishes setup before continuing`, async () => {
    mocks.catalog.mockResolvedValue({ ok: false, error })
    render(<PreparingCard businessId="biz" language="en" readyHref="/ready" />)
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/ready"))
    expect(mocks.finish).toHaveBeenCalledExactlyOnceWith("biz")
    expect(mocks.photo).not.toHaveBeenCalled()
  })
}

test("a finished business skips the rows", async () => {
  mocks.catalog.mockResolvedValue({ ok: true, summary: { created: false } })
  render(<PreparingCard businessId="biz" language="en" readyHref="/ready" />)
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled())
  expect(mocks.photo).not.toHaveBeenCalled()
})

