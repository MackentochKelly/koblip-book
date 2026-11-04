import { expect, test } from "vitest"

import { AFTER_LOGIN_PATH, loginHref, resetPasswordHref } from "./auth-links"
import { safeNext } from "./safe-next"

test.each([
  [{}, "/login"],
  [{ next: "/join/abc" }, "/login?next=%2Fjoin%2Fabc"],
  [{ language: "es" }, "/login?lang=es"],
  [{ next: "/connect", language: "en" }, "/login?next=%2Fconnect&lang=en"],
] as const)("loginHref(%j) is %s", (link, href) => {
  expect(loginHref(link)).toBe(href)
})

test("resetPasswordHref keeps the way back and the language", () => {
  expect(resetPasswordHref({ next: "/connect", language: "es" })).toBe(
    "/reset-password?next=%2Fconnect&lang=es"
  )
})

test("a way back that is itself a link survives the trip", () => {
  const signUp = "/login?name=Ana+%26+Co&business=ana&finish=1&lang=es"
  const next = new URL(
    resetPasswordHref({ next: signUp }),
    "https://book.example.com"
  ).searchParams.get("next")
  expect(next).toBe(signUp)
  expect(safeNext(next)).toBe(signUp)
})

test("a bad way back lands where a login does", () => {
  expect(safeNext("//evil.example.com")).toBe(AFTER_LOGIN_PATH)
})
