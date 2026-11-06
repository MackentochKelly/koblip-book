import "server-only"

import { and, eq, inArray, isNull } from "drizzle-orm"
import type { Messages } from "next-intl"
import { db } from "@/lib/db"
import { translationEntries } from "@/lib/db/schema"
import type { PageLanguage } from "@/lib/page-language"
import { sameIcuFields } from "./icu"
import { isTranslationLanguage } from "./languages"
import { isShown, TRANSLATION_STATUSES } from "./rules"

// The app's own words (docs/plans/translations.md, G4): English in code
// (i18n/messages.ts), every other language from `translation_entries`,
// kept in memory until one of them changes. A word without a usable
// translation shows in English.

type Tree = { [key: string]: string | Tree }

interface Store {
  english: Messages | null
  // One load per language; dropped when a translation changes.
  byLanguage: Map<PageLanguage, Promise<Messages>>
}

// On globalThis: the server's start-up code (instrumentation.ts) and its
// pages are bundled apart, and both must see the same words.
const STORE_KEY = Symbol.for("koblip.interface-words")

function store(): Store {
  const holder = globalThis as { [STORE_KEY]?: Store }
  holder[STORE_KEY] ??= { english: null, byLanguage: new Map() }
  return holder[STORE_KEY]
}

// The English words, given once by the code that has them all
// (i18n/request.ts, i18n/sync.ts).
export function registerEnglishWords(english: Messages): void {
  const words = store()
  if (words.english !== english) {
    words.english = english
    words.byLanguage.clear()
  }
}

export function englishWords(): Messages {
  const english = store().english
  if (!english) {
    throw new Error("The English words aren't registered yet (i18n/messages.ts)")
  }
  return english
}

// Every word as its key ("owner.bookings.title") and English.
export function flattenWords(words: Messages): { key: string; text: string }[] {
  const all: { key: string; text: string }[] = []
  const walk = (tree: Tree, prefix: string) => {
    for (const [name, value] of Object.entries(tree)) {
      const key = prefix ? `${prefix}.${name}` : name
      if (typeof value === "string") all.push({ key, text: value })
      else walk(value, key)
    }
  }
  walk(words as unknown as Tree, "")
  return all
}

// The part of the app a word belongs to, for the admin's filter: its first
// two names ("owner.bookings", "admin.translations").
export function wordModule(key: string): string {
  return key.split(".").slice(0, 2).join(".")
}

// The words in a language: English where a translation is missing, not
// shown yet, or lost a field.
export function wordsFor(language: PageLanguage): Promise<Messages> {
  const english = englishWords()
  if (!isTranslationLanguage(language)) return Promise.resolve(english)
  const words = store()
  const cached = words.byLanguage.get(language)
  if (cached) return cached
  // A database error shows the English for now (not kept, so the next page
  // tries again), never an error page.
  const loading = loadWords(english, language).catch((error: unknown) => {
    console.error("Couldn't read the app's translated words", error)
    if (words.byLanguage.get(language) === loading) {
      words.byLanguage.delete(language)
    }
    return english
  })
  words.byLanguage.set(language, loading)
  return loading
}

// After a translation of the app's words changes (Google, an admin, the
// sync): the next page reads them again.
export function forgetInterfaceWords(): void {
  store().byLanguage.clear()
}

const SHOWN = TRANSLATION_STATUSES.filter(isShown)

async function loadWords(
  english: Messages,
  language: PageLanguage
): Promise<Messages> {
  const rows = await db
    .select({ key: translationEntries.key, text: translationEntries.text })
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.scope, "interface"),
        isNull(translationEntries.businessId),
        eq(translationEntries.language, language),
        inArray(translationEntries.status, SHOWN)
      )
    )
  const translated = new Map<string, string>()
  for (const row of rows) {
    if (row.text) translated.set(row.key, row.text)
  }
  const fill = (tree: Tree, prefix: string): Tree => {
    const out: Tree = {}
    for (const [name, value] of Object.entries(tree)) {
      const key = prefix ? `${prefix}.${name}` : name
      if (typeof value === "string") {
        const text = translated.get(key)
        out[name] = text && sameIcuFields(value, text) ? text : value
      } else {
        out[name] = fill(value, key)
      }
    }
    return out
  }
  return fill(english as unknown as Tree, "") as unknown as Messages
}
