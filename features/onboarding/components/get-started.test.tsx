import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"

const { search } = vi.hoisted(() => ({
  search: {
    searchBusinesses: vi.fn(),
    searchBusinessesByText: vi.fn(),
    searchCities: vi.fn(),
    cityCenter: vi.fn(),
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
  search.searchCities.mockResolvedValue([
    { placeId: "city-1", name: "Brockton", region: "MA, USA" },
  ])
  search.cityCenter.mockResolvedValue({ latitude: 41, longitude: -70 })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function showSuggestedSearch() {
  mockLocation("granted")
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  fireEvent.focus(screen.getByRole("searchbox"))
  await screen.findByRole("button", { name: /Near me/ })
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
    near: { latitude: 42, longitude: -71 },
  })
  await waitFor(() => expect(document.activeElement).toBe(first))
})

test("focus stays where the owner moved it while the search ran", async () => {
  const row = await showSuggestedSearch()
  fireEvent.click(row)
  const area = screen.getByRole("button", { name: /Near me/ })
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
  const watchPosition = vi.fn((found: PositionCallback) =>
    found({ coords: { latitude: 42, longitude: -71 } } as GeolocationPosition)
  )
  Object.defineProperty(navigator, "geolocation", {
    value: { clearWatch: vi.fn(), watchPosition },
    configurable: true,
  })
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi
        .fn()
        .mockResolvedValue(Object.assign(new EventTarget(), { state })),
    },
    configurable: true,
  })
  return watchPosition
}

function tapSearch() {
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  fireEvent.focus(screen.getByRole("searchbox"))
}

test("first tap: never asked opens our panel, and its button asks the browser", async () => {
  const watchPosition = mockLocation("prompt")
  tapSearch()

  const use = await screen.findByRole("button", {
    name: "Use my current location",
  })
  expect(watchPosition).not.toHaveBeenCalled()
  fireEvent.click(use)

  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
})

test("first tap: a location already allowed is used without the panel", async () => {
  const watchPosition = mockLocation("granted")
  tapSearch()

  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
  expect(watchPosition).toHaveBeenCalledTimes(1)
  expect(watchPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    {
      maximumAge: ONBOARDING_RULES.locationMaxAgeMs,
      timeout: ONBOARDING_RULES.locationTimeoutMs,
    }
  )
  expect(
    screen.queryByRole("button", { name: "Use my current location" })
  ).toBeNull()
})

test("first tap: a visitor who said no is offered cities only", async () => {
  const watchPosition = mockLocation("denied")
  tapSearch()

  expect(
    await screen.findByRole("searchbox", { name: "Search a city" })
  ).toBeTruthy()
  expect(watchPosition).not.toHaveBeenCalled()
  expect(
    screen.queryByRole("button", { name: "Use my current location" })
  ).toBeNull()
})

test("opening Anywhere directly respects an existing refusal", async () => {
  mockLocation("denied")
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  fireEvent.click(screen.getByRole("button", { name: "Anywhere" }))
  await screen.findByRole("searchbox", { name: "Search a city" })
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

function mockLocationError(code: 1 | 2 | 3) {
  mockLocation("prompt")
  Object.defineProperty(navigator, "geolocation", {
    value: {
      clearWatch: vi.fn(),
      watchPosition: vi.fn(
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

test("a granted read starts on mount and never opens a panel while pending", async () => {
  const { get, succeed } = pendingLocation()
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /Anywhere/ }).hasAttribute("disabled")
    ).toBe(false)
  )
  fireEvent.click(screen.getByRole("searchbox"))
  await act(
    async () =>
      new Promise((done) => setTimeout(done, ONBOARDING_RULES.debounceMs * 4))
  )
  fireEvent.click(screen.getByRole("searchbox"))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(get).toHaveBeenCalledTimes(1)
  succeed()
  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
})

test("a second unavailable position does not blame device settings", async () => {
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
      "Couldn't find you. Try again or pick a city."
    )
  )
})

// Keep browser callbacks pending so competing user actions can finish first.
function pendingLocation(state: PermissionState = "granted") {
  mockLocation(state)
  const get =
    vi.fn<(found: PositionCallback, failed: PositionErrorCallback) => void>()
  Object.defineProperty(navigator, "geolocation", {
    value: { clearWatch: vi.fn(), watchPosition: get },
    configurable: true,
  })
  return {
    get,
    succeed: () =>
      act(() =>
        get.mock.calls[0][0]({
          coords: { latitude: 42, longitude: -71 },
        } as GeolocationPosition)
      ),
  }
}

test("two taps during the permission check start one location read", async () => {
  const { get } = pendingLocation()
  tapSearch()
  fireEvent.focus(screen.getByRole("searchbox"))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
})

test("a dismissed user-initiated read still selects Near me without reopening", async () => {
  const { get, succeed } = pendingLocation("prompt")
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: /Use my current location/ })
  )
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  fireEvent.click(screen.getByRole("searchbox", { name: "Your business name" }))
  expect(get).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("dialog")).toBeNull()
  succeed()
  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
  fireEvent.click(screen.getByRole("searchbox", { name: "Your business name" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(get).toHaveBeenCalledTimes(1)
})

test("a location timeout keeps the retry action", async () => {
  mockLocationError(3)
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my current location" })
  )
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Location timed out. Try again or pick a city."
  )
})

test("OS denial with a browser grant keeps retry and device guidance", async () => {
  mockLocationError(1)
  const status = await navigator.permissions.query({ name: "geolocation" })
  Object.assign(status, { state: "granted" })
  tapSearch()
  const use = await screen.findByRole("button", {
    name: "Use my current location",
  })
  await screen.findByRole("alert")
  fireEvent.click(use)
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("device settings")
  )
})

test("permission changes update the open panel and remove the listener on unmount", async () => {
  mockLocation("denied")
  const status = await navigator.permissions.query({ name: "geolocation" })
  const remove = vi.spyOn(status, "removeEventListener")
  tapSearch()
  await screen.findByRole("searchbox", { name: "Search a city" })
  act(() => {
    Object.assign(status, { state: "granted" })
    status.dispatchEvent(new Event("change"))
  })
  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
  cleanup()
  expect(remove).toHaveBeenCalledWith("change", expect.any(Function))
})

test("a tap while reading starts no second read", async () => {
  const { get } = pendingLocation()
  tapSearch()
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole("searchbox"))
  expect(get).toHaveBeenCalledTimes(1)
})

test("a picked city wins over an older location callback", async () => {
  const { succeed } = pendingLocation("prompt")
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my current location" })
  )
  const city = await screen.findByRole("searchbox", { name: "Search a city" })
  fireEvent.change(city, { target: { value: "Brockton" } })
  fireEvent.click(await screen.findByRole("button", { name: /Brockton/ }))
  await screen.findByRole("button", { name: "Brockton" })
  succeed()
  expect(screen.queryByRole("button", { name: /Near me/ })).toBeNull()
})

test("late city details cannot reopen a dismissed panel", async () => {
  mockLocation("prompt")
  let resolve!: (center: { latitude: number; longitude: number }) => void
  search.cityCenter.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  tapSearch()
  fireEvent.change(
    await screen.findByRole("searchbox", { name: "Search a city" }),
    {
      target: { value: "Brockton" },
    }
  )
  fireEvent.click(await screen.findByRole("button", { name: /Brockton/ }))
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await act(async () => resolve({ latitude: 41, longitude: -70 }))
  expect(screen.queryByRole("button", { name: "Brockton" })).toBeNull()
})

test("permission-query rejection falls back to a user-initiated request", async () => {
  const get = mockLocation("prompt")
  vi.spyOn(navigator.permissions, "query").mockRejectedValue(
    new TypeError("unsupported")
  )
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my current location" })
  )
  expect(get).toHaveBeenCalledTimes(1)
  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
})

test("a fast success leaves no slow-panel timer", async () => {
  mockLocation("granted")
  tapSearch()
  await screen.findByRole("button", { name: /Near me/ })
  await act(async () => new Promise((done) => setTimeout(done, 700)))
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("business searches wait for a selected area", async () => {
  mockLocation("prompt")
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Studio" },
  })
  await act(async () => new Promise((done) => setTimeout(done, 350)))
  expect(search.searchBusinesses).not.toHaveBeenCalled()
})

test("Spanish location success uses the existing translated pill", async () => {
  mockLocation("granted")
  render(<GetStarted signedIn={false} claim={vi.fn()} language="es" />)
  fireEvent.focus(screen.getByRole("searchbox"))
  expect(
    await screen.findByRole("button", { name: /Cerca de mí/ })
  ).toBeTruthy()
})

test("changing language translates an already selected current location", async () => {
  mockLocation("granted")
  const view = render(
    <GetStarted signedIn={false} claim={vi.fn()} language="en" />
  )
  fireEvent.focus(screen.getByRole("searchbox"))
  await screen.findByRole("button", { name: /Near me/ })
  view.rerender(<GetStarted signedIn={false} claim={vi.fn()} language="es" />)
  expect(screen.getByRole("button", { name: /Cerca de mí/ })).toBeTruthy()
})

test("unmount retires background location callbacks", async () => {
  const { get, succeed } = pendingLocation()
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  cleanup()
  succeed()
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.queryByRole("button", { name: /Near me/ })).toBeNull()
})

test("permission revocation retires a location still being read", async () => {
  const { get, succeed } = pendingLocation()
  const status = await navigator.permissions.query({ name: "geolocation" })
  tapSearch()
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  act(() => {
    Object.assign(status, { state: "denied" })
    status.dispatchEvent(new Event("change"))
  })
  succeed()
  expect(screen.queryByRole("button", { name: /Near me/ })).toBeNull()
  expect(
    screen.queryByRole("button", { name: /Use my current location/ })
  ).toBeNull()
})

test("a late error after closing cannot reopen the panel", async () => {
  const { get } = pendingLocation("prompt")
  tapSearch()
  fireEvent.click(
    await screen.findByRole("button", { name: /Use my current location/ })
  )
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await act(async () =>
    get.mock.calls[0][1]({ code: 3 } as GeolocationPositionError)
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  fireEvent.click(screen.getByRole("searchbox", { name: "Your business name" }))
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my current location" })
  )
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
})

test("closing during a permission query hides the later slow read", async () => {
  const { get, succeed } = pendingLocation()
  const status = await navigator.permissions.query({ name: "geolocation" })
  let resolve!: (status: PermissionStatus) => void
  vi.spyOn(navigator.permissions, "query").mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  tapSearch()
  fireEvent.click(screen.getByRole("button", { name: "Anywhere" }))
  fireEvent.click(await screen.findByRole("button", { name: "Close" }))
  await act(async () => resolve(status))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  await act(
    async () =>
      new Promise((done) => setTimeout(done, ONBOARDING_RULES.debounceMs * 4))
  )
  expect(screen.queryByRole("dialog")).toBeNull()
  succeed()
  expect(await screen.findByRole("button", { name: /Near me/ })).toBeTruthy()
})

test("a new mount requests the browser cache rather than persisting coordinates", async () => {
  const get = mockLocation("granted")
  tapSearch()
  await screen.findByRole("button", { name: /Near me/ })
  cleanup()
  tapSearch()
  await screen.findByRole("button", { name: /Near me/ })
  expect(get).toHaveBeenCalledTimes(2)
  expect(get).toHaveBeenLastCalledWith(
    expect.any(Function),
    expect.any(Function),
    {
      maximumAge: ONBOARDING_RULES.locationMaxAgeMs,
      timeout: ONBOARDING_RULES.locationTimeoutMs,
    }
  )
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("prompt permission on mount never requests location or opens a dialog", async () => {
  const get = mockLocation("prompt")
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  await act(async () => {})
  expect(get).not.toHaveBeenCalled()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("typing while granted location is pending searches and reruns near the returned position", async () => {
  const { get, succeed } = pendingLocation()
  let resolveOld!: (results: unknown[]) => void
  search.searchBusinesses.mockReturnValueOnce(
    new Promise((done) => {
      resolveOld = done
    })
  )
  search.searchBusinesses.mockResolvedValueOnce([
    {
      kind: "business",
      placeId: "nearby",
      name: "Nearby studio",
      address: "Brockton",
    },
  ])
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Studio" },
  })
  await waitFor(() =>
    expect(search.searchBusinesses).toHaveBeenCalledWith(
      expect.objectContaining({ input: "Studio", near: undefined })
    )
  )
  expect(screen.queryByRole("dialog")).toBeNull()
  succeed()
  await waitFor(() =>
    expect(search.searchBusinesses).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: "Studio",
        near: { latitude: 42, longitude: -71 },
      })
    )
  )
  await screen.findByRole("button", { name: /Nearby studio/ })
  await act(async () =>
    resolveOld([
      {
        kind: "business",
        placeId: "old",
        name: "Faraway studio",
        address: "Elsewhere",
      },
    ])
  )
  expect(screen.queryByRole("button", { name: /Faraway studio/ })).toBeNull()
})

test.each([2, 3] as const)(
  "an automatic granted read failure %i opens the existing error panel",
  async (code) => {
    mockLocationError(code)
    const status = await navigator.permissions.query({ name: "geolocation" })
    Object.assign(status, { state: "granted" })
    render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
    expect((await screen.findByRole("alert")).textContent).toBe(
      code === 3
        ? "Location timed out. Try again or pick a city."
        : "Couldn't find you. Try again or pick a city."
    )
  }
)

test("a later permission grant does not replace a city the visitor already picked", async () => {
  const get = mockLocation("prompt")
  const status = await navigator.permissions.query({ name: "geolocation" })
  tapSearch()
  fireEvent.change(
    await screen.findByRole("searchbox", { name: "Search a city" }),
    {
      target: { value: "Brockton" },
    }
  )
  fireEvent.click(await screen.findByRole("button", { name: /Brockton/ }))
  await screen.findByRole("button", { name: "Brockton" })
  act(() => {
    Object.assign(status, { state: "granted" })
    status.dispatchEvent(new Event("change"))
  })
  expect(get).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Brockton" })).toBeTruthy()
})

test("both controls stop at the wait limit, keep one pending request, and accept a late location", async () => {
  vi.useFakeTimers()
  const { get, succeed } = pendingLocation()
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  await act(async () => {})
  const pill = screen.getByRole("button", { name: /Anywhere/ })
  expect(pill.hasAttribute("disabled")).toBe(false)
  expect(pill.querySelector('[data-slot="spinner"]')).not.toBeNull()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
  })
  expect(pill.querySelector('[data-slot="spinner"]')).toBeNull()
  expect(pill.textContent).toBe("Anywhere")
  expect(get).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("searchbox"))
  expect(screen.getByRole("status").textContent).toBe(
    "Taking longer than expected. You can pick a city."
  )
  expect(
    screen
      .getByRole("button", { name: "Use my current location" })
      .hasAttribute("disabled")
  ).toBe(true)
  expect(get).toHaveBeenCalledTimes(1)
  succeed()
  expect(
    screen.getByRole("button", { name: /Near me/, hidden: true })
  ).toBeTruthy()
})

test.each([false, true])(
  "a city picked with the pill before/after progress expires (%s) beats late location",
  async (expired) => {
    vi.useFakeTimers()
    const { get, succeed } = pendingLocation()
    render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
    await act(async () => {})
    expect(get).toHaveBeenCalledTimes(1)
    if (expired) {
      act(() => {
        vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
      })
      expect(
        screen
          .getByRole("button", { name: /Anywhere/ })
          .querySelector('[data-slot="spinner"]')
      ).toBeNull()
    }
    vi.useRealTimers()
    fireEvent.click(screen.getByRole("button", { name: /Anywhere/ }))
    const city = await screen.findByRole("searchbox", { name: "Search a city" })
    fireEvent.change(city, { target: { value: "Brockton" } })
    fireEvent.click(await screen.findByRole("button", { name: /Brockton/ }))
    await screen.findByRole("button", { name: "Brockton" })
    succeed()
    expect(screen.queryByRole("button", { name: /Near me/ })).toBeNull()
    expect(
      screen
        .getByRole("button", { name: "Brockton" })
        .querySelector('[data-slot="spinner"]')
    ).toBeNull()
  }
)

test("unmount clears the display timer for a pending location read", async () => {
  const { get } = pendingLocation()
  const schedule = vi.spyOn(globalThis, "setTimeout")
  const clear = vi.spyOn(globalThis, "clearTimeout")
  render(<GetStarted signedIn={false} claim={vi.fn()} language="en" />)
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  const index = schedule.mock.calls.findIndex(
    ([, delay]) => delay === ONBOARDING_RULES.locationWaitMs
  )
  expect(index).toBeGreaterThanOrEqual(0)
  cleanup()
  expect(clear).toHaveBeenCalledWith(schedule.mock.results[index].value)
})
