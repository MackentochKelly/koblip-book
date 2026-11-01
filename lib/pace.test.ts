import { afterEach, expect, test, vi } from "vitest"

import { atLeast } from "./pace"

afterEach(() => {
  vi.useRealTimers()
})

test("atLeast waits the minimum when the work is already done", async () => {
  vi.useFakeTimers()
  let settled = false
  const done = atLeast(Promise.resolve("ok"), 1000).then((value) => {
    settled = true
    return value
  })
  await vi.advanceTimersByTimeAsync(999)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await expect(done).resolves.toBe("ok")
})

test("atLeast waits for slower work past the minimum", async () => {
  vi.useFakeTimers()
  let finish: (value: string) => void = () => {}
  let settled = false
  const done = atLeast(
    new Promise<string>((resolve) => {
      finish = resolve
    }),
    1000
  ).then((value) => {
    settled = true
    return value
  })
  await vi.advanceTimersByTimeAsync(5000)
  expect(settled).toBe(false)
  finish("late")
  await expect(done).resolves.toBe("late")
})

test("atLeast passes the work's error on", async () => {
  vi.useFakeTimers()
  const done = atLeast(Promise.reject(new Error("boom")), 1000)
  const caught = done.catch((error: Error) => error.message)
  await vi.advanceTimersByTimeAsync(1000)
  await expect(caught).resolves.toBe("boom")
})
