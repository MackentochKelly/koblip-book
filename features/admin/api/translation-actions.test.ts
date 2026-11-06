// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
  editTranslation: vi.fn(),
  resetTranslation: vi.fn(),
  retryTranslation: vi.fn(),
  setTranslationRule: vi.fn(),
  translateSoon: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateBusiness: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/dal", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/revalidate-business", () => ({
  revalidateBusiness: mocks.revalidateBusiness,
}))
vi.mock("@/lib/translations/schedule", () => ({
  translateSoon: mocks.translateSoon,
}))
vi.mock("@/lib/translations/edits", () => ({
  editTranslation: mocks.editTranslation,
  resetTranslation: mocks.resetTranslation,
  retryTranslation: mocks.retryTranslation,
}))
vi.mock("@/lib/translations/settings", async () => {
  class TranslationRuleError extends Error {}
  return {
    TranslationRuleError,
    isTranslationRuleKey: (key: string) => key === "runTexts",
    setTranslationRule: mocks.setTranslationRule,
  }
})
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: async () => [{ slug: "palacete" }] }),
    }),
  },
}))

const {
  resetTranslationToGoogle,
  retryFailedTranslation,
  saveTranslationRule,
  saveTranslationText,
} = await import("./translation-actions")
const { TranslationRuleError } = await import("@/lib/translations/settings")

const entry = { id: "e1", businessId: "biz" }

beforeEach(() => {
  vi.clearAllMocks()
})

test("an admin's translation is saved as the admin, and the business page refreshes", async () => {
  mocks.editTranslation.mockResolvedValueOnce({ ok: true, entry })
  expect(await saveTranslationText("e1", "Corte")).toEqual({ ok: true })
  expect(mocks.editTranslation).toHaveBeenCalledWith({ id: "e1", text: "Corte", userId: "admin" })
  expect(mocks.revalidateBusiness).toHaveBeenCalledWith("palacete")
  expect(mocks.translateSoon).not.toHaveBeenCalled()
})

test("the typed words' problem comes back as it is", async () => {
  mocks.editTranslation.mockResolvedValueOnce({ ok: false, error: "fields" })
  expect(await saveTranslationText("e1", "x")).toEqual({ ok: false, error: "fields" })
})

test("nothing runs for anyone but an admin", async () => {
  mocks.requireAdmin.mockRejectedValueOnce(new Error("not found"))
  await expect(saveTranslationText("e1", "x")).rejects.toThrow()
  expect(mocks.editTranslation).not.toHaveBeenCalled()
})

test("odd input never reaches the database", async () => {
  expect(await saveTranslationText("", "x")).toEqual({ ok: false, error: "invalid" })
  expect(await saveTranslationText("e1", 5 as unknown as string)).toEqual({ ok: false, error: "invalid" })
  expect(await saveTranslationText("e1", "x".repeat(100_001))).toEqual({ ok: false, error: "invalid" })
  expect(await resetTranslationToGoogle(7 as unknown as string)).toEqual({ ok: false, error: "invalid" })
  expect(mocks.editTranslation).not.toHaveBeenCalled()
  expect(mocks.resetTranslation).not.toHaveBeenCalled()
})

test("Reset to Google and Retry send the text to Google right after", async () => {
  mocks.resetTranslation.mockResolvedValueOnce({ ok: true, entry })
  mocks.retryTranslation.mockResolvedValueOnce({ ok: true, entry })
  expect(await resetTranslationToGoogle("e1")).toEqual({ ok: true })
  expect(await retryFailedTranslation("e1")).toEqual({ ok: true })
  expect(mocks.resetTranslation).toHaveBeenCalledWith({ id: "e1", userId: "admin" })
  expect(mocks.retryTranslation).toHaveBeenCalledWith({ id: "e1", userId: "admin" })
  expect(mocks.translateSoon).toHaveBeenCalledTimes(2)
})

test("an unexpected error reads as failed", async () => {
  mocks.retryTranslation.mockRejectedValueOnce(new Error("database is locked"))
  vi.spyOn(console, "error").mockImplementationOnce(() => {})
  expect(await retryFailedTranslation("e1")).toEqual({ ok: false, error: "failed" })
})

test("a rule is saved as the admin; an unknown rule or value is invalid", async () => {
  expect(await saveTranslationRule("runTexts", 100)).toEqual({ ok: true })
  expect(mocks.setTranslationRule).toHaveBeenCalledWith({ key: "runTexts", value: 100, userId: "admin" })
  expect(await saveTranslationRule("timerSeconds" as "runTexts", 5)).toEqual({ ok: false, error: "invalid" })
  mocks.setTranslationRule.mockRejectedValueOnce(new TranslationRuleError("runTexts"))
  expect(await saveTranslationRule("runTexts", -1)).toEqual({ ok: false, error: "invalid" })
})
