import { expect, test } from "vitest"
import { buildVoiceLine } from "./system-prompt"

test("English voice overrides lookup silence and keeps confirmation silence", () => {
  const line = buildVoiceLine("en")
  expect(line).toContain(
    "This overrides 'Write nothing before read-only lookups'"
  )
  expect(line).toContain("same turn")
  expect(line).toContain("Never use time promises")
  expect(line).toContain("write nothing; the app says it out loud")
  expect(line).not.toContain("ask them to tap confirm")
})

test("Spanish voice overrides lookup silence and keeps confirmation silence", () => {
  const line = buildVoiceLine("es")
  expect(line).toContain("Esto anula")
  expect(line).toContain("solo lectura")
  expect(line).toContain("mismo turno")
  expect(line).toContain("Nunca prometas tiempos")
  expect(line).toContain("no escribas nada; la aplicación")
  expect(line).not.toContain("pídele que pulse confirmar")
})
