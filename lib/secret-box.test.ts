// @vitest-environment node
import { randomBytes } from "node:crypto"
import { beforeAll, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { open, seal } = await import("./secret-box")

beforeAll(() => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"))
})

test("a sealed secret opens again and never shows the secret", () => {
  const sealed = seal("kor_secret-token")
  expect(sealed).not.toContain("kor_secret-token")
  expect(seal("kor_secret-token")).not.toBe(sealed)
  expect(open(sealed)).toBe("kor_secret-token")
})

test("a changed value or another key does not open", () => {
  const sealed = seal("kor_secret-token")
  const parts = sealed.split(".")
  parts[3] = Buffer.from("changed").toString("base64url")
  expect(() => open(parts.join("."))).toThrow()
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"))
  expect(() => open(sealed)).toThrow()
})

test("a missing or short key is refused", () => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", "short")
  expect(() => seal("x")).toThrow(/TOKEN_ENCRYPTION_KEY/)
})
