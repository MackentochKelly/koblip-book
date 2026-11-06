import "server-only"

import type { TranslationServiceClient } from "@google-cloud/translate"
import { TRANSLATION_RULES } from "./rules"

// Who translates: Google Cloud Translation, Advanced (v3), its default NMT
// model (docs/plans/translations.md). Never Meta.
export interface Translator {
  name: "google" | "fake"
  // HTML texts in, their translations out, in the same order.
  translate(htmls: string[], googleLanguage: string): Promise<string[]>
}

const store = globalThis as typeof globalThis & {
  koblipGoogleTranslate?: TranslationServiceClient
}

// Google once GOOGLE_CLOUD_PROJECT is set (the client finds the service
// account through GOOGLE_APPLICATION_CREDENTIALS); the fake only when asked
// for outside production; otherwise none, and texts wait.
export function getTranslator(): Translator | null {
  if (
    process.env.TRANSLATION_PROVIDER === "fake" &&
    process.env.NODE_ENV !== "production"
  ) {
    return fakeTranslator
  }
  const project = process.env.GOOGLE_CLOUD_PROJECT
  return project ? googleTranslator(project) : null
}

function googleTranslator(project: string): Translator {
  return {
    name: "google",
    async translate(htmls, googleLanguage) {
      const client = await googleClient()
      // https://docs.cloud.google.com/translate/docs/advanced/translating-text-v3
      const [response] = await client.translateText(
        {
          parent: `projects/${project}/locations/global`,
          contents: htmls,
          mimeType: "text/html",
          sourceLanguageCode: "en",
          targetLanguageCode: googleLanguage,
        },
        { timeout: TRANSLATION_RULES.requestTimeoutMs }
      )
      const translations = response.translations ?? []
      if (translations.length !== htmls.length) {
        throw new Error(
          `Google answered ${translations.length} of ${htmls.length} texts`
        )
      }
      return translations.map((item) => item.translatedText ?? "")
    },
  }
}

async function googleClient(): Promise<TranslationServiceClient> {
  if (!store.koblipGoogleTranslate) {
    const { TranslationServiceClient } = await import("@google-cloud/translate")
    store.koblipGoogleTranslate = new TranslationServiceClient()
  }
  return store.koblipGoogleTranslate
}

// For development and tests: marks the text with its language instead of
// translating it. Its translations are made again by Google later.
const fakeTranslator: Translator = {
  name: "fake",
  async translate(htmls, googleLanguage) {
    return htmls.map((html) => `[${googleLanguage}] ${html}`)
  },
}
