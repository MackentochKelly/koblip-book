// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isPluralElement, parse } from "@formatjs/icu-messageformat-parser"
import { and, eq, like } from "drizzle-orm"
import { createTranslator, type Messages } from "next-intl"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import {
  businesses,
  platformSettingChanges,
  platformSettings,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import { DEFAULT_LOCALES, PAGE_LANGUAGE_HEADER } from "@/lib/page-language"
import {
  GOOGLE_LANGUAGE_CODES,
  TRANSLATION_LANGUAGES,
  type TranslationLanguage,
} from "./languages"
import type { Translator } from "./provider"
import type { TranslationScope } from "./rules"

// G9 (docs/plans/translations.md): what the translations promise, for both
// kinds of text (a business's own, the app's own words) in every
// translation language (es, pt, fr), the way the app runs it: a save or a
// release records the English, the queue sends it to Google (a stand-in
// here, never the real one), and a page reads the result.

const page = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: async () => page.headers }))
// next-intl's own getRequestConfig (react-server) hands back the function.
vi.mock("next-intl/server", () => ({
  getRequestConfig: (create: unknown) => create,
}))

const {
  flattenWords,
  forgetInterfaceWords,
  registerEnglishWords,
  wordModule,
  wordsFor,
} = await import("./interface-words")
const { runTranslationQueue, syncTexts } = await import("./queue")
const { getBusinessTranslations, syncBusinessTexts } = await import(
  "./business-texts"
)
const { editTranslation, resetTranslation, retryTranslation } = await import(
  "./edits"
)
const { setTranslationRule, translationRules } = await import("./settings")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

const NOW = new Date("2026-11-06T12:00:00.000Z")
const at = (minutes: number) => () => new Date(NOW.getTime() + minutes * 60_000)
const LANGUAGES = [...TRANSLATION_LANGUAGES]
const code = (language: TranslationLanguage) => GOOGLE_LANGUAGE_CODES[language]

type GoogleStandIn = Translator & {
  // Google's language code of each request, in order.
  languages: string[]
}

// Google stand-in: Google's language code before each text ("pt-BR:…"),
// kept parts as they are unless `change` changes them.
function google(change: (html: string) => string = (html) => html): GoogleStandIn {
  const languages: string[] = []
  return {
    name: "google",
    languages,
    async translate(htmls, googleLanguage) {
      languages.push(googleLanguage)
      return htmls.map((html) => `${googleLanguage}:${change(html)}`)
    },
  }
}

function broken(): GoogleStandIn {
  const languages: string[] = []
  return {
    name: "google",
    languages,
    async translate(_htmls, googleLanguage): Promise<string[]> {
      languages.push(googleLanguage)
      throw new Error("Google is down")
    },
  }
}

// The app's words as a release brings them: registered, then synced at the
// server's start (i18n/sync.ts).
async function releaseWords(english: object, register = true) {
  const words = english as unknown as Messages
  if (register) registerEnglishWords(words)
  await syncTexts({
    scope: "interface",
    businessId: null,
    items: flattenWords(words).map(({ key, text }) => ({
      key,
      module: wordModule(key),
      text,
    })),
    removeMissing: true,
  })
}

interface ScopeCase {
  scope: TranslationScope
  name: string
  key: string
  // Writes the English as the app does: the owner's save, or a release.
  write(text: string): Promise<void>
  // What a page in the language shows for it.
  shown(language: TranslationLanguage, english: string): Promise<string>
  // A text with parts Google must keep, and Google answers that lose one.
  fields: {
    english: string
    kept: string[]
    losses: Record<string, (html: string) => string>
    // An admin's translation, then new English it lacks a part of.
    edit: string
    next: string
  }
}

const FIELD = '<span translate="no">{name}</span>'

const SCOPES: ScopeCase[] = [
  {
    scope: "business",
    name: "a business's text",
    key: "biz:business.description",
    async write(text) {
      await db
        .update(businesses)
        .set({ description: text })
        .where(eq(businesses.id, "biz"))
      await syncBusinessTexts("biz")
    },
    async shown(language, english) {
      const translated = await getBusinessTranslations("biz", language)
      return translated("biz", "business.description", english)
    },
    fields: {
      english: "Hi {name}, book at https://koblip.com/b/shop or write to hello@shop.com",
      kept: ["{name}", "https://koblip.com/b/shop", "hello@shop.com"],
      losses: {
        field: (html) => html.replace(FIELD, "nome"),
        link: (html) => html.replace("https://koblip.com/b/shop", "https://koblip.com/b/loja"),
        email: (html) => html.replace("hello@shop.com", "ola@shop.com"),
      },
      edit: "Olá {name}, reserve em https://koblip.com/b/shop ou escreva para hello@shop.com",
      next: "Hi {name}, book at https://koblip.com/b/shop or write to new@shop.com",
    },
  },
  {
    scope: "interface",
    name: "an app word",
    key: "shop.title",
    async write(text) {
      await releaseWords({ shop: { title: text } })
    },
    async shown(language) {
      const words = (await wordsFor(language)) as unknown as {
        shop: { title: string }
      }
      return words.shop.title
    },
    fields: {
      english: "Hi {name}, read the <link>terms</link>",
      kept: ["{name}", "<link>", "</link>"],
      losses: {
        field: (html) => html.replace(FIELD, "nome"),
        tag: (html) => html.replace(/<span data-t="0">(.*?)<\/span>/, "$1"),
      },
      edit: "Olá {name}, leia os <link>termos</link>",
      next: "Hi {name}, read the <link>terms</link> by {date}",
    },
  },
]

async function entry(scope: TranslationScope, key: string, language: string) {
  const [row] = await db
    .select()
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.scope, scope),
        eq(translationEntries.key, key),
        eq(translationEntries.language, language)
      )
    )
  return row
}

async function actions(entryId: string) {
  const rows = await db
    .select({ action: translationHistory.action })
    .from(translationHistory)
    .where(eq(translationHistory.entryId, entryId))
    .orderBy(translationHistory.id)
  return rows.map((row) => row.action)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translations-g9-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  ;({ db } = await import("@/lib/db"))
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "admin",
    name: "Admin",
    email: "admin@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values(
    ["biz", "spa"].map((id) => ({
      id,
      slug: id,
      name: id,
      timezone: "America/New_York",
      currency: "USD",
      ownerId: "admin",
    }))
  )
})

beforeEach(async () => {
  await db
    .delete(platformSettings)
    .where(like(platformSettings.key, "translation.%"))
  await db.delete(platformSettingChanges)
  await db.delete(translationHistory)
  // The migrations' own Spanish words too: each test brings its words.
  await db.delete(translationEntries)
  await db.update(businesses).set({ description: null, category: null })
  // The app's English as the server has it before any word is synced.
  registerEnglishWords({ shop: { title: "Haircut" } } as unknown as Messages)
  forgetInterfaceWords()
})

afterEach(() => {
  vi.useRealTimers()
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

describe.each(SCOPES)("$name", ({ scope, key, write, shown, fields }) => {
  const row = (language: TranslationLanguage) => entry(scope, key, language)

  test.each(LANGUAGES)(
    "%s: changed English is translated again by Google; the English shows meanwhile",
    async (language) => {
      // Missing: the English.
      expect(await shown(language, "Haircut")).toBe("Haircut")
      await write("Haircut")
      expect(await row(language)).toMatchObject({ status: "pending", text: null })
      expect(await shown(language, "Haircut")).toBe("Haircut")
      await runTranslationQueue({ now: at(0), translator: google() })
      expect(await shown(language, "Haircut")).toBe(`${code(language)}:Haircut`)

      await write("Long haircut")
      expect(await row(language)).toMatchObject({
        status: "pending",
        sourceText: "Long haircut",
        text: `${code(language)}:Haircut`,
      })
      // Google's translation of the old English never shows for the new.
      expect(await shown(language, "Long haircut")).toBe("Long haircut")
      const again = google()
      await runTranslationQueue({ now: at(0), translator: again })
      expect(again.languages).toContain(code(language))
      expect(await row(language)).toMatchObject({
        status: "automatic",
        origin: "google",
        text: `${code(language)}:Long haircut`,
      })
      expect(await shown(language, "Long haircut")).toBe(
        `${code(language)}:Long haircut`
      )
      const { id } = await row(language)
      expect(await actions(id)).toEqual(["google", "source_changed", "google"])
    }
  )

  test.each(LANGUAGES)(
    "%s: an edited translation is kept when the English changes and needs review",
    async (language) => {
      await write("Haircut")
      await runTranslationQueue({ now: at(0), translator: google() })
      const { id } = await row(language)
      expect((await editTranslation({ id, text: "Corte", userId: "admin" })).ok).toBe(true)
      await write("Long haircut")
      expect(await row(language)).toMatchObject({
        status: "needs_review",
        origin: "manual",
        sourceText: "Long haircut",
        text: "Corte",
      })
      // Only the other languages' automatic translations go to Google again.
      const again = google()
      await runTranslationQueue({ now: at(0), translator: again })
      expect(again.languages.sort()).toEqual(
        LANGUAGES.filter((other) => other !== language).map(code).sort()
      )
      expect(await row(language)).toMatchObject({ status: "needs_review", text: "Corte" })
      expect(await shown(language, "Long haircut")).toBe("Corte")
      expect(await actions(id)).toEqual(["google", "edited", "source_changed"])
      // Saving it again marks it reviewed.
      await editTranslation({ id, text: "Corte", userId: "admin" })
      expect((await row(language)).status).toBe("edited")
    }
  )

  test.each(LANGUAGES)(
    "%s: a missing, waiting or failed translation shows the English",
    async (language) => {
      await write("Haircut")
      expect(await shown(language, "Haircut")).toBe("Haircut")
      await runTranslationQueue({ now: at(0), translator: google() })
      const { id } = await row(language)
      // Missing in this language while the others have theirs.
      await db.delete(translationEntries).where(eq(translationEntries.id, id))
      forgetInterfaceWords()
      expect(await shown(language, "Haircut")).toBe("Haircut")
      const other = LANGUAGES.find((each) => each !== language)!
      expect(await shown(other, "Haircut")).toBe(`${code(other)}:Haircut`)
      // Failed, though it still holds an older translation.
      await write("Long haircut")
      await db
        .update(translationEntries)
        .set({ status: "failed" })
        .where(
          and(
            eq(translationEntries.key, key),
            eq(translationEntries.language, other)
          )
        )
      forgetInterfaceWords()
      expect((await entry(scope, key, other)).text).toBe(`${code(other)}:Haircut`)
      expect(await shown(other, "Long haircut")).toBe("Long haircut")
    }
  )

  test.each(LANGUAGES)(
    "%s: Google down: retried at the rule's waits, then Failed; Retry sends it again",
    async (language) => {
      await setTranslationRule({ key: "retryMinutes", value: [2, 10], userId: "admin" })
      const { retryMinutes } = await translationRules()
      await write("Haircut")
      const down = broken()
      const tries = () => down.languages.filter((each) => each === code(language)).length
      let minutes = 0
      for (const [index, wait] of retryMinutes.entries()) {
        await runTranslationQueue({ now: at(minutes), translator: down })
        expect(await row(language)).toMatchObject({
          status: "pending",
          attempts: index + 1,
          lastError: "Google is down",
          nextAttemptAt: at(minutes + wait)().toISOString(),
        })
        // Not due again before its wait.
        await runTranslationQueue({ now: at(minutes + wait - 0.5), translator: down })
        expect(tries()).toBe(index + 1)
        minutes += wait
      }
      await runTranslationQueue({ now: at(minutes), translator: down })
      expect(await row(language)).toMatchObject({
        status: "failed",
        attempts: retryMinutes.length + 1,
        lastError: "Google is down",
        nextAttemptAt: null,
      })
      expect(tries()).toBe(retryMinutes.length + 1)
      expect(await shown(language, "Haircut")).toBe("Haircut")
      // Failed stays Failed: the timer never sends it again by itself.
      await runTranslationQueue({ now: at(minutes + 24 * 60), translator: down })
      expect(tries()).toBe(retryMinutes.length + 1)

      const { id } = await row(language)
      expect((await retryTranslation({ id, userId: "admin" })).ok).toBe(true)
      const back = google()
      await runTranslationQueue({ now: at(minutes + 24 * 60), translator: back })
      // Only the retried text goes again.
      expect(back.languages).toEqual([code(language)])
      expect(await row(language)).toMatchObject({
        status: "automatic",
        attempts: 0,
        lastError: null,
        text: `${code(language)}:Haircut`,
      })
      expect(await shown(language, "Haircut")).toBe(`${code(language)}:Haircut`)
      expect(await actions(id)).toEqual(["failed", "retry", "google"])
    }
  )

  test.each(LANGUAGES)(
    "%s: fields, links and emails are kept; a translation that loses one isn't used",
    async (language) => {
      const { english, kept, losses } = fields
      await write(english)
      let minutes = 0
      for (const [part, lose] of Object.entries(losses)) {
        await runTranslationQueue({ now: at(minutes), translator: google(lose) })
        expect(await row(language), part).toMatchObject({
          status: "pending",
          text: null,
          lastError: "Google changed a field, link or email",
        })
        expect(await shown(language, english), part).toBe(english)
        minutes += 24 * 60
      }
      // Billed all the same.
      const { id } = await row(language)
      const billed = await db
        .select({ action: translationHistory.action, characters: translationHistory.characters })
        .from(translationHistory)
        .where(eq(translationHistory.entryId, id))
      expect(billed).toHaveLength(Object.keys(losses).length)
      expect(billed.every((item) => item.action === "google" && item.characters > 0)).toBe(true)

      await runTranslationQueue({ now: at(minutes), translator: google() })
      const text = await shown(language, english)
      expect(text).toBe(`${code(language)}:${english}`)
      for (const part of kept) expect(text).toContain(part)
      // An admin's own translation can't lose one either.
      expect(await editTranslation({ id, text: "Olá", userId: "admin" })).toEqual({
        ok: false,
        error: "fields",
      })
      expect(await shown(language, english)).toBe(text)
    }
  )

  test.each(LANGUAGES)(
    "%s: an edit that needs review shows only while it has the new English's parts",
    async (language) => {
      const { english, edit, next } = fields
      await write(english)
      await runTranslationQueue({ now: at(0), translator: google() })
      const { id } = await row(language)
      expect((await editTranslation({ id, text: edit, userId: "admin" })).ok).toBe(true)
      expect(await shown(language, english)).toBe(edit)
      // The English got a new email or field the admin's text doesn't have.
      await write(next)
      expect(await row(language)).toMatchObject({ status: "needs_review", text: edit })
      expect(await shown(language, next)).toBe(next)
      // Back to English the edit fits: it shows again.
      await write(english)
      expect(await shown(language, english)).toBe(edit)
    }
  )

  test.each(LANGUAGES)(
    "%s: past the daily limit the rest waits for the next day (UTC)",
    async (language) => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(NOW)
      const { dailyBusinessCharacters } = await translationRules()
      expect(dailyBusinessCharacters).toBe(50_000)
      const filler = "x".repeat(4_500)
      await syncTexts({
        scope,
        businessId: scope === "business" ? "biz" : null,
        languages: [language],
        items: Array.from({ length: 12 }, (_, index) => ({
          key: scope === "business" ? `s${index}:service.description` : `shop.long${index}`,
          module: scope === "business" ? "service.description" : "shop",
          text: `${index} ${filler}`,
        })),
      })
      // 11 texts of about 4,500 characters fit in 50,000; the 12th doesn't.
      expect(await runTranslationQueue({ now: at(0), translator: google() })).toMatchObject({
        translated: 11,
        deferred: 1,
      })
      const [waiting] = await db
        .select()
        .from(translationEntries)
        .where(eq(translationEntries.status, "pending"))
      expect(waiting).toMatchObject({ language, nextAttemptAt: "2026-11-07T00:00:00.000Z" })
      const later = google()
      expect(await runTranslationQueue({ now: at(60), translator: later })).toMatchObject({
        translated: 0,
      })
      expect(later.languages).toEqual([])
      const nextDay = new Date("2026-11-07T00:00:00.000Z")
      vi.setSystemTime(nextDay)
      expect(
        await runTranslationQueue({ now: () => nextDay, translator: google() })
      ).toMatchObject({ translated: 1, deferred: 0 })
    }
  )

  test.each(LANGUAGES)(
    "%s: an admin's edit, Reset to Google and Google's answer show at the next read",
    async (language) => {
      await write("Haircut")
      await runTranslationQueue({ now: at(0), translator: google() })
      expect(await shown(language, "Haircut")).toBe(`${code(language)}:Haircut`)
      const { id } = await row(language)
      await editTranslation({ id, text: "Corte", userId: "admin" })
      expect(await shown(language, "Haircut")).toBe("Corte")
      await resetTranslation({ id, userId: "admin" })
      expect(await shown(language, "Haircut")).toBe("Haircut")
      await runTranslationQueue({ now: at(0), translator: google() })
      expect(await shown(language, "Haircut")).toBe(`${code(language)}:Haircut`)
    }
  )
})

test("a business's languages share its daily limit; the app's words have their own", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  const filler = "x".repeat(9_000)
  const items = (prefix: string) =>
    Array.from({ length: 4 }, (_, index) => ({
      key: `${prefix}${index}`,
      module: "shop",
      // Each its own English, so none is Google's earlier one reused.
      text: `${prefix} ${index} ${filler}`,
    }))
  await syncTexts({ scope: "business", businessId: "biz", items: items("s:") })
  await syncTexts({ scope: "interface", businessId: null, items: items("shop.long") })
  // 4 texts in 3 languages each: 5 of 9,000 fit in 50,000, for the business
  // and for the app's words apart.
  expect(await runTranslationQueue({ now: at(0), translator: google() })).toMatchObject({
    translated: 10,
    deferred: 14,
  })
  // Another business still has its whole day.
  await syncTexts({ scope: "business", businessId: "spa", items: items("t:").slice(0, 1) })
  expect(await runTranslationQueue({ now: at(1), translator: google() })).toMatchObject({
    translated: LANGUAGES.length,
    deferred: 0,
  })
})

test.each(LANGUAGES)(
  "%s: the app's words are read from memory until one changes",
  async (language) => {
    const english = { shop: { title: "Bookings" } }
    await releaseWords(english)
    await runTranslationQueue({ now: at(0), translator: google() })
    const words = await wordsFor(language)
    expect(await wordsFor(language)).toBe(words)
    const read = async () =>
      ((await wordsFor(language)) as unknown as { shop: { title: string } }).shop.title
    expect(await read()).toBe(`${code(language)}:Bookings`)
    // A release with new English: the sync drops what pages read, so the
    // English shows until Google's arrives.
    const next = { shop: { title: "Your bookings" } }
    registerEnglishWords(next as unknown as Messages)
    await read()
    await releaseWords(next, false)
    expect(await read()).toBe("Your bookings")
    await runTranslationQueue({ now: at(0), translator: google() })
    expect(await read()).toBe(`${code(language)}:Your bookings`)
  }
)

test.each(LANGUAGES)(
  "%s: a page in the language gets Google's words, and the English for a missing one",
  async (language) => {
    const { default: messages } = await import("@/i18n/messages")
    const { default: requestConfig } = await import("@/i18n/request")
    registerEnglishWords(messages)
    // Two plain words of the real catalog.
    const [translated, missing] = flattenWords(messages).filter(({ text }) =>
      /^[\p{L} ]+$/u.test(text)
    )
    await syncTexts({
      scope: "interface",
      businessId: null,
      languages: [language],
      items: [{ key: translated.key, module: wordModule(translated.key), text: translated.text }],
    })
    await runTranslationQueue({ now: at(0), translator: google() })
    page.headers = new Headers({ [PAGE_LANGUAGE_HEADER]: language })
    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) })
    expect(config.locale).toBe(DEFAULT_LOCALES[language])
    const word = (dotted: string) =>
      dotted
        .split(".")
        .reduce<unknown>(
          (tree, name) => (tree as Record<string, unknown>)[name],
          config.messages
        )
    expect(word(translated.key)).toBe(`${code(language)}:${translated.text}`)
    expect(word(missing.key)).toBe(missing.text)
  }
)

// Google stand-in for plural sentences: each language's words for them,
// kept parts as they are.
const POUND = '<span translate="no">#</span>'
const PLURAL_WORDS: Record<TranslationLanguage, Record<string, string>> = {
  es: {
    booking: "reserva",
    bookings: "reservas",
    "No bookings left": "No quedan reservas",
    "booking left": "reserva restante",
    "bookings left": "reservas restantes",
  },
  pt: {
    booking: "reserva",
    bookings: "reservas",
    "No bookings left": "Nenhuma reserva restante",
    "booking left": "reserva restante",
    "bookings left": "reservas restantes",
  },
  fr: {
    booking: "réservation",
    bookings: "réservations",
    "No bookings left": "Plus aucune réservation",
    "booking left": "réservation restante",
    "bookings left": "réservations restantes",
  },
}

function pluralGoogle(language: TranslationLanguage): Translator {
  return {
    name: "google",
    async translate(htmls, googleLanguage) {
      expect(googleLanguage).toBe(code(language))
      return htmls.map((html) => {
        const words = html.startsWith(`${POUND} `) ? html.slice(POUND.length + 1) : html
        const answer = PLURAL_WORDS[language][words]
        if (!answer) throw new Error(`No ${language} words for ${html}`)
        return words === html ? answer : `${POUND} ${answer}`
      })
    },
  }
}

test.each(LANGUAGES)(
  "%s: a plural comes back with the language's own options and formats 0, 1, 2 and 1,000,000",
  async (language) => {
    const english = {
      shop: {
        count: "{count, plural, one {# booking} other {# bookings}}",
        left: "{count, plural, =0 {No bookings left} one {# booking left} other {# bookings left}}",
      },
    }
    registerEnglishWords(english as unknown as Messages)
    await syncTexts({
      scope: "interface",
      businessId: null,
      languages: [language],
      items: flattenWords(english as unknown as Messages).map(({ key, text }) => ({
        key,
        module: wordModule(key),
        text,
      })),
    })
    expect(
      await runTranslationQueue({ now: at(0), translator: pluralGoogle(language) })
    ).toMatchObject({ translated: 2, failed: 0, retrying: 0 })

    const locale = DEFAULT_LOCALES[language]
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
    for (const name of ["count", "left"]) {
      const { text } = await entry("interface", `shop.${name}`, language)
      const [plural] = parse(text!)
      if (!isPluralElement(plural)) throw new Error(`Not a plural: ${text}`)
      const options = Object.keys(plural.options)
      expect(options).toContain("other")
      for (const option of options) {
        expect(option.startsWith("=") || categories.includes(option as Intl.LDMLPluralRule)).toBe(true)
      }
    }

    const t = async () =>
      createTranslator({
        locale,
        messages: (await wordsFor(language)) as unknown as typeof english,
        namespace: "shop",
      })
    const number = (value: number) => new Intl.NumberFormat(locale).format(value)
    const one = PLURAL_WORDS[language].booking
    const other = PLURAL_WORDS[language].bookings
    // Spanish says "0 reservas"; Brazilian Portuguese and French put 0 in
    // `one` (CLDR), as Intl.PluralRules does.
    const zero = language === "es" ? other : one
    const counts = await t()
    expect([0, 1, 2, 1_000_000].map((count) => counts("count", { count }))).toEqual([
      `0 ${zero}`,
      `1 ${one}`,
      `2 ${other}`,
      // Google's options are English's (one, other): `many` reads as other.
      `${number(1_000_000)} ${other}`,
    ])
    expect([0, 1, 2].map((count) => counts("left", { count }))).toEqual([
      PLURAL_WORDS[language]["No bookings left"],
      `1 ${PLURAL_WORDS[language]["booking left"]}`,
      `2 ${PLURAL_WORDS[language]["bookings left"]}`,
    ])

    // An admin may add the language's own `many` form.
    const { id } = await entry("interface", "shop.count", language)
    const many = `{count, plural, one {# ${one}} many {# de ${other}} other {# ${other}}}`
    expect((await editTranslation({ id, text: many, userId: "admin" })).ok).toBe(true)
    const edited = await t()
    expect(edited("count", { count: 1_000_000 })).toBe(`${number(1_000_000)} de ${other}`)
    expect(edited("count", { count: 2 })).toBe(`2 ${other}`)
    expect(edited("count", { count: 1 })).toBe(`1 ${one}`)
  }
)
