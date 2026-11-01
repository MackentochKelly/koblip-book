import { expect, test } from "vitest"
import { isTidiedName } from "./tidy-name"

test("accepts other capitals, no symbols, and dropping what follows a separator", () => {
  expect(isTidiedName("BARBERSHOP NEAR ME™", "Barbershop Near Me")).toBe(true)
  expect(isTidiedName("milk + honey | Downtown Austin", "milk + honey")).toBe(true)
  expect(isTidiedName("Barbería Nader - Mejor corte en Santo Domingo", "Barbería Nader")).toBe(true)
  expect(isTidiedName("BARBERIA NADER", "Barbería Nader")).toBe(true)
})

test("rejects dropped, new, reordered or translated words and empty names", () => {
  expect(isTidiedName("BARBERSHOP NEAR ME™", "Barbershop")).toBe(false)
  expect(isTidiedName("Barbería Nader", "Nader Barbería")).toBe(false)
  expect(isTidiedName("Love Tea Cafe", "Love Tea Café & Bakery")).toBe(false)
  expect(isTidiedName("Peluquería El Estilo", "The Style Salon")).toBe(false)
  expect(isTidiedName("Sofia", "  ™ ")).toBe(false)
})
