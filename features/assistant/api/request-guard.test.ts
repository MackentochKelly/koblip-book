// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { isCrossSiteRequest, requestBudget } = await import("./request-guard")

function request(origin: string | null) {
  const headers: Record<string, string> = {}
  if (origin !== null) {
    headers.origin = origin
  }
  return new Request("http://localhost/api/assistant", { headers })
}

test("same origin and missing origin are allowed", () => {
  expect(isCrossSiteRequest(request("http://localhost"))).toBe(false)
  expect(isCrossSiteRequest(request(null))).toBe(false)
})

test("another port counts as another host", () => {
  expect(isCrossSiteRequest(request("http://localhost:3000"))).toBe(true)
})

test("another host and garbage origins are refused", () => {
  expect(isCrossSiteRequest(request("https://evil.com"))).toBe(true)
  expect(isCrossSiteRequest(request("not a url"))).toBe(true)
})

test("budget carries an already-aborted signal and done is safe twice", () => {
  const controller = new AbortController()
  controller.abort()
  const pending = new Request("http://localhost/api/assistant", {
    signal: controller.signal,
  })
  const budget = requestBudget(pending)
  expect(budget.signal.aborted).toBe(true)
  budget.done()
  budget.done()
})

test("budget is live until done", () => {
  const budget = requestBudget(request(null))
  expect(budget.signal.aborted).toBe(false)
  budget.done()
})
