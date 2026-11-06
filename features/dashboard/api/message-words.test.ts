// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq, like } from "drizzle-orm"
import { afterAll, beforeAll, expect, test, vi } from "vitest"

import { translationEntries } from "@/lib/db/schema"
import { welcomeDefaults } from "../utils/automation-defaults"
import { CAPTURED_BOOK_WORDS, CAPTURED_WELCOME } from "./message-words.captured"

vi.mock("server-only", () => ({}))

let dir: string
let closeDb: () => void

// English from code, Spanish from a database migrated with every migration.
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-message-words-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  const { registerEnglishWords } =
    await import("@/lib/translations/interface-words")
  registerEnglishWords((await import("@/i18n/messages")).default)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("Book's English and Spanish words are the ones Meta approved, to the byte", async () => {
  const { bookWordsFor } = await import("./message-words")
  expect(await bookWordsFor("en")).toStrictEqual(CAPTURED_BOOK_WORDS.en)
  expect(await bookWordsFor("es")).toStrictEqual(CAPTURED_BOOK_WORDS.es)
})

test("the Welcome flow's English and Spanish are the ones Book stored, to the byte", async () => {
  const { welcomeWords } = await import("./message-words")
  const defaults = welcomeDefaults(await welcomeWords())
  for (const language of ["en", "es"] as const) {
    expect({
      wording: defaults.wording[language],
      buttons: defaults.buttons.map(({ id, label, action }) => ({
        id,
        label: label[language],
        action,
      })),
    }).toStrictEqual(CAPTURED_WELCOME[language])
  }
})

test("the Spanish is the app's words: without its rows it reads the English", async () => {
  const { db } = await import("@/lib/db")
  const { forgetInterfaceWords } =
    await import("@/lib/translations/interface-words")
  const { bookWordsFor } = await import("./message-words")
  await db
    .delete(translationEntries)
    .where(
      and(
        eq(translationEntries.language, "es"),
        like(translationEntries.key, "owner.whatsapp.bookWording.%")
      )
    )
  forgetInterfaceWords()
  const spanish = await bookWordsFor("es")
  expect(spanish.wording).toStrictEqual(CAPTURED_BOOK_WORDS.en.wording)
  expect(spanish.locale).toBe("es-US")
})
