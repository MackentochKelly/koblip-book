// @vitest-environment node
import { expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { serverMessagesFor } = await import("./server")

test("english stays english", () => {
  const t = serverMessagesFor("en")
  expect(t.locale).toBe("en-US")
  expect(t.languageLine).toBe("Reply in English.")
  expect(t.steps.services).toBe("Listing services…")
  expect(t.cards.cancel).toBe("Cancel this booking?")
  expect(t.cancel.done).toBe("Cancelled the booking.")
})

test("spanish translates chips, cards and results", () => {
  const t = serverMessagesFor("es")
  expect(t.locale).toBe("es-US")
  expect(t.languageLine).toBe("Responde en español.")
  expect(t.steps.services).toBe("Listando servicios…")
  expect(t.cards.cancel).toBe("¿Cancelar esta reserva?")
  expect(t.cancel.done).toBe("Reserva cancelada.")
  expect(t.confirm.unchanged).toBe("Vale, no se cambió nada.")
  expect(t.loop.stopped(8)).toContain("8")
})

test("unknown or missing language falls back to english", () => {
  for (const language of ["fr", "", undefined, null]) {
    const t = serverMessagesFor(language as never)
    expect(t.locale).toBe("en-US")
    expect(t.steps.services).toBe("Listing services…")
  }
})
