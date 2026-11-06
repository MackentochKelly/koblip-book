// @vitest-environment node
import { expect, test } from "vitest"

import { serverWords } from "@/i18n/testing"
import type { ServerWords } from "../types"

const t: ServerWords = await serverWords().getTranslations("assistantServer")

test("the server's lines read as next-intl gives them", () => {
  expect(t("steps.services")).toBe("Listing services…")
  expect(t("cards.cancel")).toBe("Cancel this booking?")
  expect(t("cancel.done")).toBe("Cancelled the booking.")
  expect(t("confirm.unchanged")).toBe("Okay, nothing was changed.")
})

test("fields fill in with the old functions' parameter names", () => {
  expect(
    t("booking.booked", { name: "Ana", service: "Cut", when: "Friday" })
  ).toBe("Done! Ana is booked for Cut on Friday.")
  expect(t("errors.queryInvalid", { max: "80" })).toBe(
    "query must be 1-80 characters"
  )
  expect(t("booking.minutes", { durationMinutes: "30" })).toBe("30 min")
})
