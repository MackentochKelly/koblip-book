import { getTranslations } from "next-intl/server"
import { expect, test, vi } from "vitest"

import { durationIn } from "./format-duration"

vi.mock("next-intl/server", async () =>
  (await import("@/i18n/testing")).serverWords()
)

const words = () => getTranslations("app.duration")

test("formats minutes under an hour", async () => {
  expect(durationIn(await words(), 45)).toBe("45 min")
})

test("formats exact hours", async () => {
  expect(durationIn(await words(), 60)).toBe("1 h")
  expect(durationIn(await words(), 120)).toBe("2 h")
})

test("formats hours and minutes", async () => {
  expect(durationIn(await words(), 90)).toBe("1 h 30 min")
})
