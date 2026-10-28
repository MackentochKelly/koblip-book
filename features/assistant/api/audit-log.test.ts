// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ db: { insert: vi.fn() } }))

const { db } = await import("@/lib/db")
const { logAssistantAction } = await import("./audit-log")

const values = vi.fn()

beforeEach(() => {
  values.mockReset().mockResolvedValue(undefined)
  vi.mocked(db.insert).mockReturnValue({ values } as never)
})

test("writes one audit row", async () => {
  await logAssistantAction({
    businessId: "b1",
    ownerId: "u1",
    tool: "create_service",
    summary: 'created "Cut"',
    status: "ok",
  })
  expect(db.insert).toHaveBeenCalledTimes(1)
  expect(values).toHaveBeenCalledWith({
    businessId: "b1",
    ownerId: "u1",
    tool: "create_service",
    summary: 'created "Cut"',
    status: "ok",
  })
})

test("a failed write resolves and logs a short code only", async () => {
  values.mockRejectedValueOnce(new Error("secret db detail +15551234567"))
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    await expect(
      logAssistantAction({
        businessId: "b1",
        ownerId: "u1",
        tool: "cancel_booking",
        summary: "x",
        status: "failed",
      })
    ).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledWith("audit-log-failed")
    const printed = error.mock.calls.flat().join(" ")
    expect(printed).not.toContain("+15551234567")
    expect(printed).not.toContain("secret db detail")
  } finally {
    error.mockRestore()
  }
})
