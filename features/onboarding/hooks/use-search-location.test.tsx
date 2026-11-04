import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import { useSearchLocation } from "./use-search-location"

let permission: PermissionStatus
let get: ReturnType<
  typeof vi.fn<
    (
      success: PositionCallback,
      error: PositionErrorCallback,
      options?: PositionOptions
    ) => number
  >
>

// Node 25 ships its own localStorage, which hides jsdom's and does not work
// without --localstorage-file, so each test gets a plain in-memory one.
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("localStorage", memoryStorage())
  permission = Object.assign(new EventTarget(), {
    state: "granted",
  }) as PermissionStatus
  get = vi.fn(() => 17)
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { clearWatch: vi.fn(), watchPosition: get },
  })
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue(permission) },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// The page has loaded and nobody has tapped anything.
async function show() {
  const hook = renderHook(() => useSearchLocation())
  await act(async () => {})
  return hook
}

// The first tap in the search box, with the browser reporting location allowed.
async function showReading() {
  const hook = await show()
  act(() => hook.result.current.askLocation())
  return hook
}

function success(index = 0) {
  act(() =>
    get.mock.calls[index][0]({
      coords: { latitude: 42, longitude: -71 },
    } as GeolocationPosition)
  )
}

async function error(code: number, index = 0) {
  await act(async () =>
    get.mock.calls[index][1]({
      code,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError)
  )
}

function changePermission(state: PermissionState) {
  act(() => {
    Object.assign(permission, { state })
    permission.dispatchEvent(new Event("change"))
  })
}

test.each(["granted", "prompt", "denied"] as const)(
  "%s permission: loading the page reads nothing and opens nothing",
  async (state) => {
    Object.assign(permission, { state })
    const { result } = await show()
    act(() => {
      vi.advanceTimersByTime(ONBOARDING_RULES.locationTimeoutMs)
    })
    expect(get).not.toHaveBeenCalled()
    expect(result.current.open).toBe(false)
    expect(result.current.view.alert).toBe("none")
  }
)

test.each(["prompt", "denied"] as const)(
  "%s permission: the first search tap opens the panel and reads nothing",
  async (state) => {
    Object.assign(permission, { state })
    const { result } = await showReading()
    expect(get).not.toHaveBeenCalled()
    expect(result.current.open).toBe(true)
    expect(result.current.state.phase).toBe(
      state === "prompt" ? "prompt" : "denied-site"
    )
    expect(result.current.view.canLocate).toBe(state === "prompt")
  }
)

test.each(["prompt", "denied"] as const)(
  "%s permission: the panel asks once, then search just runs",
  async (state) => {
    Object.assign(permission, { state })
    const { result } = await showReading()
    expect(result.current.view.search).toBe(true)
    act(() => result.current.closePanel())
    act(() => result.current.askLocation())
    expect(result.current.open).toBe(false)
    expect(result.current.view.search).toBe(true)
  }
)

test("a reload remembers the panel was seen", async () => {
  Object.assign(permission, { state: "prompt" })
  const first = await showReading()
  expect(first.result.current.open).toBe(true)
  first.unmount()
  const { result } = await showReading()
  expect(result.current.open).toBe(false)
  expect(result.current.view.search).toBe(true)
  expect(localStorage.getItem(ONBOARDING_RULES.locationAskedKey)).toBe("1")
})

test("blocked storage still asks only once in this page load", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("blocked", "SecurityError")
    },
  })
  Object.assign(permission, { state: "prompt" })
  const { result } = await showReading()
  expect(result.current.open).toBe(true)
  act(() => result.current.closePanel())
  act(() => result.current.askLocation())
  expect(result.current.open).toBe(false)
  expect(result.current.view.search).toBe(true)
})

test("a tap during the permission check is answered once, when the check ends", async () => {
  Object.assign(permission, { state: "prompt" })
  const { result } = renderHook(() => useSearchLocation())
  act(() => result.current.askLocation())
  expect(result.current.open).toBe(false)
  await act(async () => {})
  expect(result.current.open).toBe(true)
  act(() => result.current.closePanel())
  changePermission("denied")
  changePermission("prompt")
  expect(result.current.open).toBe(false)
})

test("first tap reads an allowed location; found stops both indicators and keeps search closed", async () => {
  const { result } = await showReading()
  expect(get).toHaveBeenCalledTimes(1)
  expect(get).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
    maximumAge: ONBOARDING_RULES.locationMaxAgeMs,
    timeout: ONBOARDING_RULES.locationTimeoutMs,
  })
  expect(result.current.state.phase).toBe("reading")
  expect(result.current.view.busy).toBe(true)
  act(() => result.current.askLocation())
  expect(result.current.open).toBe(false)
  success()
  expect(result.current.state.phase).toBe("found")
  expect(result.current.state.area?.isCurrentLocation).toBe(true)
  expect(result.current.view).toMatchObject({ busy: false, alert: "none" })
  act(() => result.current.askLocation())
  expect(result.current.open).toBe(false)
})

test("no answer stops the spinner without opening anything, and a late success still counts", async () => {
  const { result } = await showReading()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
  })
  expect(result.current.state.phase).toBe("unanswered")
  expect(result.current.view).toMatchObject({
    busy: false,
    canLocate: true,
    alert: "waiting",
    pending: true,
  })
  act(() => result.current.askLocation())
  expect(result.current.open).toBe(false)
  act(() => result.current.openPanel())
  expect(result.current.open).toBe(true)
  success()
  expect(result.current.state.phase).toBe("found")
  expect(result.current.open).toBe(false)
})

test("retry while still acquiring does not start another request", async () => {
  const { result } = await showReading()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
  })
  act(() => result.current.locate())
  expect(get).toHaveBeenCalledTimes(1)
  expect(result.current.state.phase).toBe("unanswered")
  success(0)
  expect(result.current.state.phase).toBe("found")
  expect(result.current.view.busy).toBe(false)
})

test.each([1, 2, 3])(
  "a quiet read failing with %i shows nothing, lets search run and does not retry by itself",
  async (code) => {
    const { result } = await showReading()
    await error(code)
    act(() => {
      vi.advanceTimersByTime(ONBOARDING_RULES.locationRetryMs)
    })
    expect(result.current.state.phase).toBe("ready")
    expect(result.current.open).toBe(false)
    expect(result.current.view).toMatchObject({
      busy: false,
      canLocate: true,
      alert: "none",
      search: true,
    })
    act(() => result.current.askLocation())
    expect(result.current.open).toBe(false)
    expect(get).toHaveBeenCalledTimes(1)
  }
)

test("a quiet read failing while the panel is open says so, and closing first keeps it quiet", async () => {
  const watched = await showReading()
  act(() => watched.result.current.openPanel())
  await error(1)
  expect(watched.result.current.state.phase).toBe("denied-other")
  expect(watched.result.current.view.alert).toBe("settings")
  watched.unmount()
  get.mockClear()

  const { result } = await showReading()
  act(() => result.current.openPanel())
  act(() => result.current.closePanel())
  await error(1)
  expect(result.current.state.phase).toBe("ready")
  expect(result.current.view.alert).toBe("none")
})

test("the panel's button still works after a quiet read failed", async () => {
  const { result } = await showReading()
  await error(1)
  get.mockReturnValue(18)
  act(() => result.current.openPanel())
  expect(result.current.view.alert).toBe("none")
  act(() => result.current.locate())
  expect(get).toHaveBeenCalledTimes(2)
  success(1)
  expect(result.current.state.phase).toBe("found")
  expect(result.current.open).toBe(false)
})

test.each([
  [2, "failed", "not-found"],
  [3, "timed-out", "timeout"],
] as const)(
  "a tapped read failing with %i says %s, never that location is blocked",
  async (code, phase, alert) => {
    const { result } = await show()
    act(() => result.current.openPanel())
    act(() => result.current.locate())
    await error(code)
    act(() => {
      vi.advanceTimersByTime(ONBOARDING_RULES.locationRetryMs)
    })
    expect(result.current.state.phase).toBe(phase)
    expect(result.current.view).toMatchObject({
      busy: false,
      canLocate: true,
      alert,
    })
    expect(result.current.open).toBe(true)
  }
)

test("position unavailable keeps the read going, so a late position still counts", async () => {
  const { result } = await show()
  act(() => result.current.locate())
  await error(2)
  expect(result.current.state.phase).toBe("reading")
  expect(navigator.geolocation.clearWatch).not.toHaveBeenCalled()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationRetryMs - 1)
  })
  success()
  expect(result.current.state.phase).toBe("found")
  expect(navigator.geolocation.clearWatch).toHaveBeenCalledExactlyOnceWith(17)
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationRetryMs)
  })
  expect(result.current.state.phase).toBe("found")
})

test("repeated position unavailable gives up once, counted from the first", async () => {
  const { result } = await show()
  act(() => result.current.locate())
  await error(2)
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationRetryMs - 1)
  })
  await error(2)
  expect(result.current.state.phase).toBe("reading")
  await act(async () => {
    vi.advanceTimersByTime(1)
  })
  expect(result.current.state.phase).toBe("failed")
  expect(navigator.geolocation.clearWatch).toHaveBeenCalledExactlyOnceWith(17)
})

test("a tapped denial with a browser grant points to the device, and keeps the button", async () => {
  const { result } = await show()
  act(() => result.current.locate())
  await error(1)
  expect(result.current.state.phase).toBe("denied-other")
  expect(result.current.view).toMatchObject({
    busy: false,
    canLocate: true,
    alert: "settings",
  })
})

test.each(["denied", "prompt"] as const)(
  "a tapped denial while the browser reports %s is a calm note with cities only",
  async (state) => {
    const { result } = await show()
    act(() => result.current.locate())
    Object.assign(permission, { state })
    await error(1)
    expect(result.current.state.phase).toBe("refused")
    expect(result.current.view).toMatchObject({
      busy: false,
      canLocate: false,
      alert: "off",
      search: true,
    })
  }
)

test("a city picked while waiting cancels acquisition and ignores late callbacks", async () => {
  const { result } = await showReading()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
  })
  act(() => result.current.locate())
  act(() =>
    result.current.pickCity({
      label: "Brockton",
      center: { latitude: 41, longitude: -70 },
    })
  )
  success(0)
  await error(2, 0)
  expect(result.current.state.phase).toBe("city")
  expect(result.current.state.area?.label).toBe("Brockton")
  expect(result.current.view).toMatchObject({ busy: false, alert: "none" })
})

test("permission revocation retires late reads, opens nothing, and restores prompt behavior when reset", async () => {
  const { result } = await showReading()
  changePermission("denied")
  success()
  expect(result.current.state.phase).toBe("denied-site")
  expect(result.current.open).toBe(false)
  changePermission("prompt")
  expect(result.current.state.phase).toBe("prompt")
  expect(result.current.open).toBe(false)
  act(() => result.current.askLocation())
  expect(result.current.open).toBe(true)
})

test("an unsupported permission query waits for an explicit button request", async () => {
  vi.spyOn(navigator.permissions, "query").mockRejectedValue(
    new TypeError("unsupported")
  )
  const { result } = await show()
  expect(get).not.toHaveBeenCalled()
  expect(result.current.state.phase).toBe("prompt")
  act(() => result.current.locate())
  success()
  expect(result.current.state.phase).toBe("found")
})

test("unmount clears the deadline and ignores late callbacks", async () => {
  const { result, unmount } = await showReading()
  unmount()
  success()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
  })
  expect(result.current.state.phase).toBe("reading")
})

test("unmount clears a read still retrying after position unavailable", async () => {
  const { result, unmount } = await showReading()
  await error(2)
  unmount()
  await act(async () => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationRetryMs)
  })
  expect(result.current.state.phase).toBe("reading")
})

test("granting a prompt after the UI deadline does not duplicate its pending request", async () => {
  Object.assign(permission, { state: "prompt" })
  const { result } = await show()
  act(() => result.current.locate())
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
  })
  changePermission("granted")
  expect(get).toHaveBeenCalledTimes(1)
  success()
  expect(result.current.state.phase).toBe("found")
})

test.each(["success", "error", "city", "revoke", "unmount"] as const)(
  "%s cancels the browser watch",
  async (action) => {
    const { result, unmount } = await showReading()
    if (action === "success") success()
    if (action === "error") await error(3)
    if (action === "city") act(() => result.current.cancelForCity())
    if (action === "revoke") changePermission("denied")
    if (action === "unmount") unmount()
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledExactlyOnceWith(17)
  }
)

test("retry after native timeout ignores queued callbacks from the cancelled watch", async () => {
  const { result } = await show()
  act(() => result.current.locate())
  await error(3)
  get.mockReturnValue(18)
  act(() => result.current.locate())
  expect(get).toHaveBeenCalledTimes(2)
  success(0)
  await error(2, 0)
  expect(result.current.state.phase).toBe("reading")
  success(1)
  expect(result.current.state.phase).toBe("found")
  expect(navigator.geolocation.clearWatch).toHaveBeenLastCalledWith(18)
})

test("late permission lookup cannot overwrite a city selection", async () => {
  const { result } = await show()
  act(() => result.current.locate())
  let resolve!: (status: PermissionStatus) => void
  vi.spyOn(navigator.permissions, "query").mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  act(() => {
    get.mock.calls[0][1]({
      code: 1,
      PERMISSION_DENIED: 1,
    } as GeolocationPositionError)
  })
  act(() =>
    result.current.pickCity({
      label: "Brockton",
      center: { latitude: 41, longitude: -70 },
    })
  )
  await act(async () => resolve(permission))
  expect(result.current.state.phase).toBe("city")
  expect(result.current.open).toBe(false)
})
