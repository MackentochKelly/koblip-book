// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

const { setNotificationRule } = vi.hoisted(() => ({
  setNotificationRule: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))
vi.mock("@/lib/platform-settings", async () => {
  class RuleValueError extends Error {}
  return { RuleValueError, setNotificationRule }
})

const { saveWhatsappRule } = await import("./whatsapp-rule-actions")
const { RuleValueError } = await import("@/lib/platform-settings")

beforeEach(() => {
  vi.clearAllMocks()
})

test("saves a rule for everyone as the admin", async () => {
  expect(await saveWhatsappRule("sendBatch", 25)).toEqual({ ok: true })
  expect(setNotificationRule).toHaveBeenCalledWith({
    key: "sendBatch",
    value: 25,
    userId: "admin",
  })
})

test("an unknown rule never reaches the save", async () => {
  expect(await saveWhatsappRule("nope" as "sendBatch", 1)).toEqual({
    ok: false,
    error: "invalid",
  })
  expect(setNotificationRule).not.toHaveBeenCalled()
})

test("a value the rule does not allow is refused as invalid", async () => {
  setNotificationRule.mockRejectedValueOnce(new RuleValueError("maxButtons"))
  expect(await saveWhatsappRule("maxButtons", 9)).toEqual({
    ok: false,
    error: "invalid",
  })
})
