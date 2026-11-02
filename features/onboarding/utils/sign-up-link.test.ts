// @vitest-environment node
import { expect, test } from "vitest"

import { readSignUpLink, signUpHref } from "./sign-up-link"

const read = (href: string) =>
  readSignUpLink(
    Object.fromEntries(new URL(href, "http://localhost").searchParams)
  )

test("a search pick goes to the sign-up page and reads back", () => {
  const found = {
    name: "El Grande",
    address: "Av. Francia 43",
    placeId: "ChIJ9xRr2lAABDQR6vq4UNtvT04",
    sessionToken: "token-1",
  }
  const href = signUpHref(found)
  expect(href.startsWith("/login?")).toBe(true)
  expect(read(href)).toEqual({ found, finish: null })
})

test("back from Google, a saved business is to be finished", () => {
  const found = { name: "El Grande", address: null, slug: "el-grande" }
  expect(read(signUpHref(found, { finish: true }))).toEqual({
    found,
    finish: "el-grande",
  })
  expect(read(signUpHref(found))?.finish).toBeNull()
})

test("a plain or broken link carries no business", () => {
  expect(read("/login")).toBeNull()
  expect(read("/login?name=A")).toBeNull()
  expect(read(`/login?name=${"x".repeat(301)}&business=a`)).toBeNull()
})
