import { describe, expect, it } from "vitest"
import { isPageLanguage, pickLanguage, pickLocale } from "./page-language"

describe("isPageLanguage", () => {
  it("accepts only en and es", () => {
    expect(isPageLanguage("en")).toBe(true)
    expect(isPageLanguage("es")).toBe(true)
    expect(isPageLanguage("fr")).toBe(false)
    expect(isPageLanguage("es-MX")).toBe(false)
    expect(isPageLanguage(undefined)).toBe(false)
    expect(isPageLanguage(null)).toBe(false)
  })
})

describe("pickLanguage", () => {
  it("lets ?lang= win", () => {
    expect(pickLanguage("es", null)).toBe("es")
    expect(pickLanguage("en", "es-MX,es;q=0.9")).toBe("en")
  })

  it("ignores junk param values", () => {
    expect(pickLanguage("fr", "es")).toBe("es")
    expect(pickLanguage("", null)).toBe("en")
    expect(pickLanguage(undefined, null)).toBe("en")
  })

  it("takes the first valid value of an array param", () => {
    expect(pickLanguage(["es"], null)).toBe("es")
    expect(pickLanguage(["fr", "es"], null)).toBe("es")
    expect(pickLanguage(["fr", "de"], "es")).toBe("es")
    expect(pickLanguage([], null)).toBe("en")
  })

  it("matches regional tags to their primary language", () => {
    expect(pickLanguage(undefined, "es-MX,es;q=0.9")).toBe("es")
    expect(pickLanguage(undefined, "en-US,en;q=0.9")).toBe("en")
  })

  it("skips unsupported languages in the header", () => {
    expect(pickLanguage(undefined, "fr-FR,es;q=0.5")).toBe("es")
    expect(pickLanguage(undefined, "fr-CA, fr;q=0.9, en;q=0.8")).toBe("en")
  })

  it("prefers the higher q value over header order", () => {
    expect(pickLanguage(undefined, "en;q=0.5,es;q=0.9")).toBe("es")
    expect(pickLanguage(undefined, "es;q=0.5,en;q=0.9")).toBe("en")
  })

  it("falls back to en", () => {
    expect(pickLanguage(undefined, "fr")).toBe("en")
    expect(pickLanguage(undefined, "")).toBe("en")
    expect(pickLanguage(undefined, null)).toBe("en")
  })
})

describe("pickLocale", () => {
  it("uses the browser's own region for the language", () => {
    expect(pickLocale("es", "es-ES,es;q=0.9,en;q=0.8")).toBe("es-ES")
    expect(pickLocale("es", "en-US,es-MX;q=0.8")).toBe("es-MX")
    expect(pickLocale("en", "en-GB")).toBe("en-GB")
  })

  it("keeps the browser's region when another language is picked", () => {
    expect(pickLocale("en", "es-ES,es;q=0.9")).toBe("en-ES")
  })

  it("falls back to the language's default without a region", () => {
    expect(pickLocale("es", "es")).toBe("es-US")
    expect(pickLocale("en", null)).toBe("en-US")
    expect(pickLocale("es", "not a tag,*")).toBe("es-US")
  })
})
