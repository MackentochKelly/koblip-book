// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import type { Messages } from "next-intl"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { translationEntries, translationHistory, user } from "@/lib/db/schema"
import type { Translator } from "./provider"

vi.mock("server-only", () => ({}))

const { flattenWords, registerEnglishWords, wordModule, wordsFor } = await import(
  "./interface-words"
)
const { runTranslationQueue, syncTexts } = await import("./queue")
const { editTranslation } = await import("./edits")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

const english = {
  shop: {
    title: "Bookings",
    count: "{count, plural, one {# booking} other {# bookings}}",
    hello: "Hi {name}",
  },
} as unknown as Messages

// Google stand-in: "ES:" before each sentence, fields untouched.
const google: Translator = {
  name: "google",
  async translate(htmls) {
    return htmls.map((html) => `ES:${html}`)
  },
}

async function sync() {
  await syncTexts({
    scope: "interface",
    businessId: null,
    items: flattenWords(english).map(({ key, text }) => ({
      key,
      module: wordModule(key),
      text,
    })),
    removeMissing: true,
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-interface-words-test-"))
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
  registerEnglishWords(english)
})

beforeEach(async () => {
  await db.delete(translationHistory)
  await db.delete(translationEntries)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("words show in English until Google's translation arrives", async () => {
  await sync()
  expect(await wordsFor("es")).toEqual(english)
  await runTranslationQueue({ translator: google })
  expect(await wordsFor("es")).toEqual({
    shop: {
      title: "ES:Bookings",
      count: "{count,plural,one{ES:# booking} other{ES:# bookings}}",
      hello: "ES:Hi {name}",
    },
  })
  expect(await wordsFor("en")).toBe(english)
})

test("a translation that lost a field shows the English", async () => {
  await sync()
  await runTranslationQueue({ translator: google })
  await db
    .update(translationEntries)
    .set({ text: "Hola" })
    .where(eq(translationEntries.key, "shop.hello"))
  // Read again after an admin's change; this one went past the checks.
  const [title] = await db
    .select({ id: translationEntries.id })
    .from(translationEntries)
    .where(eq(translationEntries.key, "shop.title"))
  await editTranslation({ id: title.id, text: "Reservas", userId: "admin" })
  const words = (await wordsFor("es")) as unknown as { shop: Record<string, string> }
  expect(words.shop.hello).toBe("Hi {name}")
  expect(words.shop.title).toBe("Reservas")
})

test("an admin's ICU translation must keep the English's fields", async () => {
  await sync()
  const [count] = await db
    .select({ id: translationEntries.id })
    .from(translationEntries)
    .where(eq(translationEntries.key, "shop.count"))
  expect(
    await editTranslation({ id: count.id, text: "{count} reservas", userId: "admin" })
  ).toEqual({ ok: false, error: "fields" })
  expect(
    (
      await editTranslation({
        id: count.id,
        text: "{count, plural, one {# reserva} other {# reservas}}",
        userId: "admin",
      })
    ).ok
  ).toBe(true)
})
