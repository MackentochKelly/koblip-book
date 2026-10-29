import { renderHook } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { useWakeLock } from "./use-wake-lock"

afterEach(() => {
  // @ts-expect-error test-only stand-in removed again
  delete navigator.wakeLock
})

function stubWakeLock() {
  const release = vi.fn(async () => {})
  const request = vi.fn(async () => ({ release }))
  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
  })
  return { request, release }
}

test("asks for the lock while active and lets go after", async () => {
  const { request, release } = stubWakeLock()
  const { rerender } = renderHook(({ on }) => useWakeLock(on), {
    initialProps: { on: false },
  })
  expect(request).not.toHaveBeenCalled()
  rerender({ on: true })
  expect(request).toHaveBeenCalledWith("screen")
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
  await Promise.resolve()
  rerender({ on: false })
  await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1))
})

test("asks again when the page comes back", () => {
  const { request } = stubWakeLock()
  renderHook(() => useWakeLock(true))
  document.dispatchEvent(new Event("visibilitychange"))
  expect(request).toHaveBeenCalledTimes(2)
})

test("a refused lock is fine", async () => {
  Object.defineProperty(navigator, "wakeLock", {
    value: { request: vi.fn(async () => Promise.reject(new Error("no"))) },
    configurable: true,
  })
  expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
})
