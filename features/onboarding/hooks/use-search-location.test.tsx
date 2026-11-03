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

beforeEach(() => {
  vi.useFakeTimers()
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
})

async function show() {
  const hook = renderHook(() => useSearchLocation())
  await act(async () => {})
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
    } as GeolocationPositionError)
  )
}

test.each(["prompt", "denied"] as const)(
  "%s permission never starts an automatic request",
  async (state) => {
    Object.assign(permission, { state })
    const { result } = await show()
    expect(get).not.toHaveBeenCalled()
    act(() => result.current.askLocation())
    expect(result.current.open).toBe(true)
    expect(result.current.state.phase).toBe(
      state === "prompt" ? "prompt" : "denied-site"
    )
    expect(result.current.view.canLocate).toBe(state === "prompt")
  }
)

test("granted reading starts on mount; found stops both indicators and keeps search closed", async () => {
  const { result } = await show()
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

test("no answer stops animation, offers cities and accepts a late success", async () => {
  const { result } = await show()
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
  expect(result.current.open).toBe(true)
  success()
  expect(result.current.state.phase).toBe("found")
  expect(result.current.open).toBe(false)
})

test("retry while still acquiring does not start another request", async () => {
  const { result } = await show()
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

test.each([2, 3])(
  "native failure %i clears both controls and offers the existing retry Alert",
  async (code) => {
    const { result } = await show()
    await error(code)
    expect(result.current.state.phase).toBe(code === 3 ? "timed-out" : "failed")
    expect(result.current.view).toMatchObject({
      busy: false,
      canLocate: true,
      alert: code === 3 ? "timeout" : "not-found",
    })
    expect(result.current.open).toBe(true)
  }
)

test("denial with a browser grant offers checks without claiming an OS cause", async () => {
  const { result } = await show()
  await error(1)
  expect(result.current.state.phase).toBe("denied-other")
  expect(result.current.view).toMatchObject({
    busy: false,
    canLocate: true,
    alert: "settings",
  })
})

test("a denied browser report hides location and offers cities", async () => {
  const { result } = await show()
  Object.assign(permission, { state: "denied" })
  await error(1)
  expect(result.current.state.phase).toBe("denied-site")
  expect(result.current.view).toMatchObject({
    busy: false,
    canLocate: false,
    alert: "none",
  })
})

test("a city picked while waiting cancels acquisition and ignores late callbacks", async () => {
  const { result } = await show()
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

test("permission revocation retires late reads and restores prompt behavior when reset", async () => {
  const { result } = await show()
  act(() => {
    Object.assign(permission, { state: "denied" })
    permission.dispatchEvent(new Event("change"))
  })
  success()
  expect(result.current.state.phase).toBe("denied-site")
  act(() => {
    Object.assign(permission, { state: "prompt" })
    permission.dispatchEvent(new Event("change"))
  })
  expect(result.current.state.phase).toBe("prompt")
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
  const { result, unmount } = await show()
  unmount()
  success()
  act(() => {
    vi.advanceTimersByTime(ONBOARDING_RULES.locationWaitMs)
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
  act(() => {
    Object.assign(permission, { state: "granted" })
    permission.dispatchEvent(new Event("change"))
  })
  expect(get).toHaveBeenCalledTimes(1)
  success()
  expect(result.current.state.phase).toBe("found")
})

test.each(["success", "error", "city", "revoke", "unmount"] as const)(
  "%s cancels the browser watch",
  async (action) => {
    const { result, unmount } = await show()
    if (action === "success") success()
    if (action === "error") await error(3)
    if (action === "city") act(() => result.current.cancelForCity())
    if (action === "revoke")
      act(() => {
        Object.assign(permission, { state: "denied" })
        permission.dispatchEvent(new Event("change"))
      })
    if (action === "unmount") unmount()
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledExactlyOnceWith(17)
  }
)

test("retry after native timeout ignores queued callbacks from the cancelled watch", async () => {
  const { result } = await show()
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
