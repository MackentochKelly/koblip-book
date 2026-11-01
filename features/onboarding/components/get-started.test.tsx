import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

const { search } = vi.hoisted(() => ({
  search: {
    searchBusinesses: vi.fn(),
    searchBusinessesByText: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("../api/search-actions", () => search)
vi.mock("../api/prepare-actions", () => ({
  prepareBusiness: vi.fn(),
  prepareBusinessFromLink: vi.fn(),
}))
vi.mock("@/features/owner-auth/components/auth-form", () => ({
  AuthForm: () => null,
}))

const { GetStarted } = await import("./get-started")

const suggested = "photography studio near Brockton, MA, USA"

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  // jsdom has no element scrolling (the mode tabs scroll to the active one).
  Element.prototype.scrollTo = vi.fn()
  search.searchBusinesses.mockResolvedValue([
    { kind: "query", text: suggested },
  ])
  search.searchBusinessesByText.mockResolvedValue([
    { placeId: "place-1", name: "Kreative Photography", address: "Brockton" },
    { placeId: "place-2", name: "Harley M Photography", address: "Brockton" },
  ])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function showSuggestedSearch() {
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "photography studio Brockton" },
  })
  return screen.findByRole("button", { name: suggested })
}

test("a suggested search moves focus to its first business", async () => {
  const row = await showSuggestedSearch()
  row.focus()
  fireEvent.click(row)

  const first = await screen.findByRole("button", {
    name: /Kreative Photography/,
  })
  expect(search.searchBusinessesByText).toHaveBeenCalledWith({
    text: suggested,
    near: undefined,
  })
  await waitFor(() => expect(document.activeElement).toBe(first))
})

test("focus stays where the owner moved it while the search ran", async () => {
  const row = await showSuggestedSearch()
  fireEvent.click(row)
  const area = screen.getByRole("button", { name: /Anywhere/ })
  area.focus()

  await screen.findByRole("button", { name: /Kreative Photography/ })
  expect(document.activeElement).toBe(area)
})
