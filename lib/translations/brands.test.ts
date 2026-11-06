import { expect, test } from "vitest"
import { brandsIn, keepsBrands } from "./brands"

test("brand names are found whole, longest first, with their own capitals", () => {
  expect(brandsIn("Koblip Book and Koblip Chat on Koblip's page")).toEqual([
    "Koblip Book",
    "Koblip Chat",
    "Koblip",
  ])
  expect(brandsIn("Meta AI, Meta and Google Maps")).toEqual([
    "Meta AI",
    "Meta",
    "Google Maps",
  ])
  expect(
    brandsIn("book a whatsapp chat, Googled metadata, Instagrammer")
  ).toEqual([])
})

test("a translation keeps every brand name as often as the English", () => {
  expect(keepsBrands("Book on WhatsApp", "Reserva por WhatsApp")).toBe(true)
  expect(keepsBrands("Koblip Book's wording", "Texto do livro")).toBe(false)
  expect(keepsBrands("Google or Google", "Google")).toBe(false)
  expect(keepsBrands("No brand here", "Sin marca")).toBe(true)
})
