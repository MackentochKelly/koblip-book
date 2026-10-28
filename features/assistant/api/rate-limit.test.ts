// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { checkAssistantRateLimit, resetAssistantRateLimitForTests } =
  await import("./rate-limit")

beforeEach(() => {
  resetAssistantRateLimitForTests()
})

test("allows up to the limit, then blocks", () => {
  expect(checkAssistantRateLimit("u1", 2, 0)).toBe(true)
  expect(checkAssistantRateLimit("u1", 2, 1_000)).toBe(true)
  expect(checkAssistantRateLimit("u1", 2, 2_000)).toBe(false)
})

test("old hits fall out of the window", () => {
  expect(checkAssistantRateLimit("u1", 1, 0)).toBe(true)
  expect(checkAssistantRateLimit("u1", 1, 30_000)).toBe(false)
  expect(checkAssistantRateLimit("u1", 1, 61_000)).toBe(true)
})

test("limits are per owner", () => {
  expect(checkAssistantRateLimit("u1", 1, 0)).toBe(true)
  expect(checkAssistantRateLimit("u2", 1, 0)).toBe(true)
})
