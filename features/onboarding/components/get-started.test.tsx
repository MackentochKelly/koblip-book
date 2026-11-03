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
// The search panel's globe draws with WebGL, which jsdom has not got.
vi.mock("@/components/voice-globe", () => ({ VoiceGlobe: () => null }))

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

test("a broken page stream ends the wait with an error, not a spinner", async () => {
  // React rejects a server promise when the page's stream breaks.
  const prepared = Promise.reject(new Error("Connection closed."))
  render(
    <GetStarted
      signedIn={false}
      claim={vi.fn()}
      hint={false}
      start={{ name: "Kreative Photography", address: "Brockton", prepared }}
      language="en"
    />
  )
  expect(
    await screen.findByText("That did not work. Please try again.")
  ).toBeTruthy()
  expect(document.querySelector('[role="status"]')).toBeNull()
})

function mockLocation(state: PermissionState) {
  const getCurrentPosition = vi.fn((found: PositionCallback) =>
    found({ coords: { latitude: 42, longitude: -71 } } as GeolocationPosition)
  )
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  })
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state }) },
    configurable: true,
  })
  return getCurrentPosition
}

function tapSearch() {
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  fireEvent.focus(screen.getByRole("searchbox"))
}

test("first tap: never asked opens our panel, and its button asks the browser", async () => {
  const getCurrentPosition = mockLocation("prompt")
  tapSearch()

  const use = await screen.findByRole("button", {
    name: "Use my current location",
  })
  expect(getCurrentPosition).not.toHaveBeenCalled()
  fireEvent.click(use)

  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
})

test("first tap: a location already allowed is used without the panel", async () => {
  const getCurrentPosition = mockLocation("granted")
  tapSearch()

  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
  expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  expect(
    screen.queryByRole("button", { name: "Use my current location" })
  ).toBeNull()
})

test("first tap: a visitor who said no is offered cities only", async () => {
  const getCurrentPosition = mockLocation("denied")
  tapSearch()

  expect(
    await screen.findByRole("searchbox", { name: "Search a city" })
  ).toBeTruthy()
  expect(getCurrentPosition).not.toHaveBeenCalled()
  expect(
    screen.queryByRole("button", { name: "Use my current location" })
  ).toBeNull()
})

test("the panel comes back on every tap until a place is picked", async () => {
  mockLocation("prompt")
  tapSearch()
  await screen.findByRole("button", { name: "Use my current location" })

  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Use my current location" })
    ).toBeNull()
  )
  fireEvent.focus(screen.getByRole("searchbox", { name: "Your business name" }))

  expect(
    await screen.findByRole("button", { name: "Use my current location" })
  ).toBeTruthy()
})

function mockLocationError(code: 1 | 2) {
  mockLocation("prompt")
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn(
        (_found: PositionCallback, failed: PositionErrorCallback) =>
          failed({ code, PERMISSION_DENIED: 1 } as GeolocationPositionError)
      ),
    },
    configurable: true,
  })
}

test("a location the browser can't read keeps the button and says so", async () => {
  mockLocationError(2)
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my current location" })
  )

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't find you. Try again or pick a city."
  )
  expect(
    screen.getByRole("button", { name: "Use my current location" })
  ).toBeTruthy()
})

test("a no at the browser's prompt leaves the cities only", async () => {
  mockLocationError(1)
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my current location" })
  )

  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Use my current location" })
    ).toBeNull()
  )
  expect(screen.getByRole("searchbox", { name: "Search a city" })).toBeTruthy()
})

test("a slow location already allowed opens the panel, on its way", async () => {
  mockLocation("granted")
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition: vi.fn() },
    configurable: true,
  })
  tapSearch()

  // The panel waits for ONBOARDING_RULES.locationPanelDelayMs first; the
  // button spins meanwhile (its Spinner is named "Loading").
  const use = await screen.findByRole(
    "button",
    { name: /Use my current location/ },
    { timeout: 3000 }
  )
  expect((use as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole("searchbox", { name: "Search a city" })).toBeTruthy()
})

test("a second failed try points to the device's location setting", async () => {
  mockLocationError(2)
  tapSearch()
  const use = await screen.findByRole("button", {
    name: "Use my current location",
  })
  fireEvent.click(use)
  await screen.findByRole("alert")
  fireEvent.click(use)

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Turn on Location for your browser in your device settings, or pick a city."
    )
  )
})
