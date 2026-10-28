import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { useStoredFlag } from "./use-stored-flag"

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
  vi.stubGlobal("localStorage", memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test("starts off and stays on once set", () => {
  const { result } = renderHook(() => useStoredFlag("test-flag"))
  expect(result.current[0]).toBe(false)
  act(() => result.current[1]())
  expect(result.current[0]).toBe(true)
  expect(window.localStorage.getItem("test-flag")).toBe("1")
})

test("every screen with the same key updates together", () => {
  const first = renderHook(() => useStoredFlag("shared-flag"))
  const second = renderHook(() => useStoredFlag("shared-flag"))
  act(() => first.result.current[1]())
  expect(second.result.current[0]).toBe(true)
})

test("blocked storage reads off and setting does not throw", () => {
  const blocked = () => {
    throw new Error("blocked")
  }
  vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked })
  const { result } = renderHook(() => useStoredFlag("blocked-flag"))
  expect(result.current[0]).toBe(false)
  expect(() => act(() => result.current[1]())).not.toThrow()
  expect(result.current[0]).toBe(false)
})
