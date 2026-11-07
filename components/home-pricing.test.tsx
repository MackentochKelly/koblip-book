import { cleanup, fireEvent, render as renderPart, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { WithWords } from "@/i18n/testing"

const { router, findBusiness } = vi.hoisted(() => ({
  router: { push: vi.fn() },
  findBusiness: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("@/hooks/use-find-business", () => ({ useFindBusiness: () => findBusiness }))
// The washes draw on a canvas jsdom doesn't have.
vi.mock("@/components/feature-preview", () => ({
  Scene: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const { HomePricing } = await import("./home-pricing")
const render = (ui: React.ReactElement) => renderPart(ui, { wrapper: WithWords })
const messages = { free: 30, pro: 200 }

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test("Pro shows both prices, its limit, and Soon on lines not built yet", () => {
  render(<HomePricing signedIn={false} choosePro={vi.fn()} messages={messages} />)
  expect(screen.getByText("$19")).toBeTruthy()
  expect(screen.getByText("or $190 a year")).toBeTruthy()
  expect(screen.getByText("30 WhatsApp messages a month")).toBeTruthy()
  expect(screen.getByText("200 WhatsApp messages a month")).toBeTruthy()
  expect(screen.getAllByText("Soon")).toHaveLength(4)
})

test("a visitor's Get Pro keeps the choice, then goes to the search", async () => {
  const choosePro = vi.fn().mockResolvedValue(undefined)
  render(<HomePricing signedIn={false} choosePro={choosePro} messages={messages} />)
  fireEvent.click(screen.getByRole("button", { name: "Get Pro" }))
  await waitFor(() => expect(findBusiness).toHaveBeenCalled())
  expect(choosePro).toHaveBeenCalled()
  expect(router.push).not.toHaveBeenCalled()
})

test("a signed-in owner's Get Pro opens their Plan screen", async () => {
  const choosePro = vi.fn().mockResolvedValue(undefined)
  render(<HomePricing signedIn choosePro={choosePro} messages={messages} />)
  fireEvent.click(screen.getByRole("button", { name: "Get Pro" }))
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard?plan=pro"))
  expect(findBusiness).not.toHaveBeenCalled()
})
