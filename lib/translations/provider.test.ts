// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))

const translateText = vi.fn()
vi.mock("@google-cloud/translate", () => ({
  TranslationServiceClient: class {
    translateText = translateText
  },
}))

const { getTranslator } = await import("./provider")

afterEach(() => {
  vi.unstubAllEnvs()
  translateText.mockReset()
})

test("no project and no fake: nothing translates yet", () => {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "")
  vi.stubEnv("TRANSLATION_PROVIDER", "")
  expect(getTranslator()).toBeNull()
})

test("the fake is never used in production", () => {
  vi.stubEnv("TRANSLATION_PROVIDER", "fake")
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "")
  vi.stubEnv("NODE_ENV", "production")
  expect(getTranslator()).toBeNull()
  vi.stubEnv("NODE_ENV", "development")
  expect(getTranslator()?.name).toBe("fake")
})

test("Google gets HTML from English, in its v3 shape, and answers in order", async () => {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "koblip-test")
  vi.stubEnv("TRANSLATION_PROVIDER", "")
  translateText.mockResolvedValue([
    { translations: [{ translatedText: "Hola" }, { translatedText: "Corte" }] },
  ])
  const translator = getTranslator()
  expect(translator?.name).toBe("google")
  expect(await translator?.translate(["Hello", "Cut"], "es")).toEqual([
    "Hola",
    "Corte",
  ])
  expect(translateText).toHaveBeenCalledWith(
    {
      parent: "projects/koblip-test/locations/global",
      contents: ["Hello", "Cut"],
      mimeType: "text/html",
      sourceLanguageCode: "en",
      targetLanguageCode: "es",
    },
    { timeout: 15_000 }
  )
})

test("an answer with a text missing is an error", async () => {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "koblip-test")
  translateText.mockResolvedValue([{ translations: [{ translatedText: "Hola" }] }])
  await expect(getTranslator()?.translate(["Hello", "Cut"], "es")).rejects.toThrow(
    "Google answered 1 of 2 texts"
  )
})
