import { describe, expect, it } from "vitest"
import {
  DEFAULT_LOCALES,
  isPageLanguage,
  LANGUAGE_NAMES,
  PAGE_LANGUAGES,
  pickLanguage,
  pickLocale,
  pickOwnerLanguage,
} from "./page-language"

describe("isPageLanguage", () => {
  it("accepts only the app's languages", () => {
    expect(isPageLanguage("en")).toBe(true)
    expect(isPageLanguage("es")).toBe(true)
    expect(isPageLanguage("pt")).toBe(true)
    expect(isPageLanguage("fr")).toBe(true)
    expect(isPageLanguage("de")).toBe(false)
    expect(isPageLanguage("es-MX")).toBe(false)
    expect(isPageLanguage("pt-BR")).toBe(false)
    expect(isPageLanguage(undefined)).toBe(false)
    expect(isPageLanguage(null)).toBe(false)
  })
})

describe("pickLanguage", () => {
  it("lets ?lang= win", () => {
    expect(pickLanguage("es", null)).toBe("es")
    expect(pickLanguage("en", "es-MX,es;q=0.9")).toBe("en")
    expect(pickLanguage("pt", "fr-FR")).toBe("pt")
    expect(pickLanguage("fr", "pt-BR")).toBe("fr")
  })

  it("ignores junk param values", () => {
    expect(pickLanguage("de", "es")).toBe("es")
    expect(pickLanguage("pt-BR", "fr")).toBe("fr")
    expect(pickLanguage("", null)).toBe("en")
    expect(pickLanguage(undefined, null)).toBe("en")
  })

  it("takes the first valid value of an array param", () => {
    expect(pickLanguage(["es"], null)).toBe("es")
    expect(pickLanguage(["de", "es"], null)).toBe("es")
    expect(pickLanguage(["de", "it"], "es")).toBe("es")
    expect(pickLanguage(["de", "pt", "es"], null)).toBe("pt")
    expect(pickLanguage([], null)).toBe("en")
  })

  it("matches regional tags to their primary language", () => {
    expect(pickLanguage(undefined, "es-MX,es;q=0.9")).toBe("es")
    expect(pickLanguage(undefined, "en-US,en;q=0.9")).toBe("en")
  })

  it("gives any Portuguese pt and any French fr", () => {
    expect(pickLanguage(undefined, "pt-BR,pt;q=0.9")).toBe("pt")
    expect(pickLanguage(undefined, "pt-PT")).toBe("pt")
    expect(pickLanguage(undefined, "pt")).toBe("pt")
    expect(pickLanguage(undefined, "fr-FR,fr;q=0.9")).toBe("fr")
    expect(pickLanguage(undefined, "fr-CA")).toBe("fr")
    expect(pickLanguage(undefined, "fr_BE")).toBe("fr")
  })

  it("skips unsupported languages in the header", () => {
    expect(pickLanguage(undefined, "de-DE,es;q=0.5")).toBe("es")
    expect(pickLanguage(undefined, "it-IT, it;q=0.9, fr;q=0.8")).toBe("fr")
  })

  it("prefers the higher q value over header order", () => {
    expect(pickLanguage(undefined, "en;q=0.5,es;q=0.9")).toBe("es")
    expect(pickLanguage(undefined, "es;q=0.5,en;q=0.9")).toBe("en")
  })

  it("falls back to en", () => {
    expect(pickLanguage(undefined, "de")).toBe("en")
    expect(pickLanguage(undefined, "")).toBe("en")
    expect(pickLanguage(undefined, null)).toBe("en")
  })
})

describe("pickLocale", () => {
  it("uses the browser's own region for the language", () => {
    expect(pickLocale("es", "es-ES,es;q=0.9,en;q=0.8")).toBe("es-ES")
    expect(pickLocale("es", "en-US,es-MX;q=0.8")).toBe("es-MX")
    expect(pickLocale("en", "en-GB")).toBe("en-GB")
    expect(pickLocale("pt", "pt-PT,pt;q=0.9")).toBe("pt-PT")
    expect(pickLocale("pt", "pt-BR")).toBe("pt-BR")
    expect(pickLocale("fr", "fr-CA,fr;q=0.9")).toBe("fr-CA")
    expect(pickLocale("fr", "fr-BE")).toBe("fr-BE")
  })

  it("keeps the browser's region when another language is picked", () => {
    expect(pickLocale("en", "es-ES,es;q=0.9")).toBe("en-ES")
    expect(pickLocale("fr", "en-CA")).toBe("fr-CA")
  })

  it("falls back to the language's default without a region", () => {
    expect(pickLocale("es", "es")).toBe("es-US")
    expect(pickLocale("en", null)).toBe("en-US")
    expect(pickLocale("es", "not a tag,*")).toBe("es-US")
    expect(pickLocale("pt", "pt")).toBe("pt-BR")
    expect(pickLocale("pt", null)).toBe("pt-BR")
    expect(pickLocale("fr", "fr")).toBe("fr-FR")
    expect(pickLocale("fr", null)).toBe("fr-FR")
  })
})

describe("pickOwnerLanguage", () => {
  it("takes the owner's pick, then the phone's language, then English", () => {
    expect(pickOwnerLanguage("es", "en-US")).toBe("es")
    expect(pickOwnerLanguage("en", "es-MX")).toBe("en")
    expect(pickOwnerLanguage(undefined, "es-MX")).toBe("es")
    expect(pickOwnerLanguage("pt", "es-MX")).toBe("pt")
    expect(pickOwnerLanguage(undefined, "fr-CA")).toBe("fr")
    expect(pickOwnerLanguage("de", "es-MX")).toBe("es")
    expect(pickOwnerLanguage(undefined, null)).toBe("en")
  })
})

describe("the app's languages", () => {
  it("each has its own name and a default format", () => {
    expect(LANGUAGE_NAMES).toEqual({
      en: "English",
      es: "Español",
      pt: "Português",
      fr: "Français",
    })
    for (const language of PAGE_LANGUAGES) {
      expect(Intl.NumberFormat.supportedLocalesOf([DEFAULT_LOCALES[language]])).toEqual([
        DEFAULT_LOCALES[language],
      ])
    }
  })
})
