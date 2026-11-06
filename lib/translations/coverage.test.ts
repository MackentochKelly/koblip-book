// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Messages } from "next-intl"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, translationEntries, user } from "@/lib/db/schema"
import type { InterfaceTranslation } from "./coverage"

vi.mock("server-only", () => ({}))

const {
  checkEnglishWords,
  checkTranslations,
  checkTypedEnglish,
  findTypedEnglish,
  groupFindings,
  hasWords,
  interfaceTranslations,
  isPageSource,
  pluralForms,
  severityOf,
} = await import("./coverage")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-coverage-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  ;({ db } = await import("@/lib/db"))
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "owner",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values({
    id: "biz",
    slug: "biz",
    name: "Shop",
    timezone: "America/New_York",
    currency: "USD",
    ownerId: "owner",
  })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

const words = (tree: object) => tree as unknown as Messages

const row = (key: string, text: string | null, more: Partial<InterfaceTranslation> = {}): InterfaceTranslation => ({
  key,
  language: "es",
  text,
  status: "automatic",
  origin: "google",
  sourceText: "",
  ...more,
})

test("English words: valid ICU, plurals and selects with other, text only", () => {
  const findings = checkEnglishWords(
    words({
      ok: "Hi {name}",
      shop: {
        count: "{count, plural, one {# booking} other {# bookings}}",
        noOther: "{count, plural, one {# booking}}",
        kind: "{kind, select, phone {Call}}",
        broken: "Hi {name",
        onlyOther: "{count, plural, other {# bookings}}",
        left: () => "old",
      },
    })
  )
  expect(findings).toEqual([
    { check: "englishNotText", where: "shop.left" },
    { check: "englishNotIcu", where: "shop.noOther", detail: "a plural or select has no other" },
    { check: "englishNotIcu", where: "shop.kind", detail: "a plural or select has no other" },
    { check: "englishNotIcu", where: "shop.broken", detail: expect.any(String) },
    { check: "pluralForms", language: "en", where: "shop.onlyOther", detail: "count: one" },
  ])
  expect(findings.map(severityOf)).toEqual(["error", "error", "error", "error", "warning"])
})

test("Spanish, French and Portuguese plurals have one, many and other", () => {
  for (const language of ["es", "fr", "pt"]) {
    expect(pluralForms(language)).toEqual(["one", "many", "other"])
  }
  expect(pluralForms("en")).toEqual(["one", "other"])
})

test("every word needs every language, shown, with the English's fields", () => {
  const english = words({
    title: "Bookings",
    hello: "Hi {name}",
    count: "{count, plural, one {# booking} other {# bookings}}",
    kind: "{kind, select, phone {Call} email {Write} other {Contact}}",
    brand: "Koblip",
    same: "Total",
    stale: "Save",
    review: "Close",
    fake: "Open",
    broken: "Book {when",
    exact: "{count, plural, =0 {None} one {# day} other {# days}}",
  })
  const rows: InterfaceTranslation[] = [
    row("title", null, { status: "pending", sourceText: "Bookings" }),
    row("hello", "Hola", { sourceText: "Hi {name}" }),
    row("count", "{count, plural, one {# reserva} other {# reservas}}", {
      sourceText: "{count, plural, one {# booking} other {# bookings}}",
    }),
    row("count", "{count, plural, one {# réservation}}", { language: "fr" }),
    row("kind", "{kind, select, phone {Llamar} other {Contactar}}", {
      status: "edited",
      origin: "manual",
      sourceText: "{kind, select, phone {Call} email {Write} other {Contact}}",
    }),
    row("brand", "Koblip", { sourceText: "Koblip" }),
    row("same", "Total", { sourceText: "Total" }),
    row("stale", "Guardar", { sourceText: "Save it" }),
    row("review", "Cerrar", { status: "needs_review", origin: "manual", sourceText: "Close" }),
    row("fake", "FAKE Open", { origin: "fake", sourceText: "Open" }),
    row("broken", "Reservar {when}", { sourceText: "Book {when" }),
    row("exact", "{count, plural, one {# día} many {# días} other {# días}}", {
      sourceText: "{count, plural, =0 {None} one {# day} other {# days}}",
    }),
    row("title", "Réservations", { language: "fr", status: "failed" }),
  ]
  const findings = checkTranslations({ english, rows, languages: ["es", "fr"] })
  const es = findings.filter((finding) => finding.language === "es")
  expect(es).toEqual([
    { check: "waiting", language: "es", where: "title" },
    {
      check: "fields",
      language: "es",
      where: "hello",
      detail: expect.stringContaining("variables"),
    },
    { check: "pluralForms", language: "es", where: "count", detail: "count: many" },
    { check: "selectOptions", language: "es", where: "kind", detail: "kind: email" },
    { check: "sameAsEnglish", language: "es", where: "same" },
    { check: "outOfDate", language: "es", where: "stale" },
    { check: "needsReview", language: "es", where: "review" },
    { check: "fake", language: "es", where: "fake" },
    { check: "pluralForms", language: "es", where: "exact", detail: "count: =0" },
  ])
  const fr = findings.filter((finding) => finding.language === "fr")
  expect(fr).toContainEqual({ check: "failed", language: "fr", where: "title" })
  expect(fr).toContainEqual({
    check: "notIcu",
    language: "fr",
    where: "count",
    detail: "a plural or select has no other",
  })
  expect(fr).toContainEqual({ check: "missing", language: "fr", where: "hello" })
  expect(fr.filter((finding) => finding.check === "missing")).toHaveLength(
    Object.keys(english).length - 2
  )
})

test("brand names, links, emails, symbols and numbers aren't words", () => {
  expect(hasWords("Koblip Book · WhatsApp")).toBe(false)
  expect(hasWords("you@example.com")).toBe(false)
  expect(hasWords("https://koblip.com/b/shop")).toBe(false)
  expect(hasWords("koblip.com")).toBe(false)
  expect(hasWords("→ 24/7 · 100% &nbsp;")).toBe(false)
  expect(hasWords("1.5x · ⌘K")).toBe(false)
  expect(hasWords("https://")).toBe(false)
  expect(hasWords("English · Español")).toBe(false)
  expect(hasWords("Open Koblip")).toBe(true)
  expect(hasWords("Koblips")).toBe(true)
  expect(hasWords("Más")).toBe(true)
})

test("English typed into JSX is found with its line", () => {
  const source = [
    'import { Button } from "@/components/ui/button"',
    "export function Part({ open, name }: { open: boolean; name: string }) {",
    "  const t = (key: string) => key",
    "  return (",
    "    <div title={t(\"title\")} className=\"flex gap-2\">",
    "      <Button aria-label=\"Close panel\">{t(\"close\")}</Button>",
    "      <input placeholder=\"you@example.com\" />",
    "      <img alt={name} src=\"/a.png\" />",
    "      <span>",
    "        Save changes",
    "      </span>",
    "      {open ? \"Open\" : t(\"closed\")}",
    "      {open && `Hi ${name}`}",
    "      <p>Koblip Book · {name} →&nbsp;</p>",
    "      <code>npm run dev</code>",
    "      <abbr title={open ? \"Opened\" : \"\"}>x</abbr>",
    "    </div>",
    "  )",
    "}",
  ].join("\n")
  expect(findTypedEnglish("features/x/part.tsx", source)).toEqual([
    { line: 6, text: "Close panel" },
    { line: 10, text: "Save changes" },
    { line: 12, text: "Open" },
    { line: 13, text: "Hi" },
    { line: 16, text: "Opened" },
  ])
  expect(checkTypedEnglish([{ path: "features/x/part.tsx", source }])[0]).toEqual({
    check: "typedEnglish",
    where: "features/x/part.tsx:6",
    detail: "Close panel",
  })
})

test("only page files are read: no tests, stories or word files", () => {
  expect(isPageSource("features/x/components/part.tsx")).toBe(true)
  expect(isPageSource("app/(owner)/layout.tsx")).toBe(true)
  expect(isPageSource("features/x/components/part.test.tsx")).toBe(false)
  expect(isPageSource("features/x/i18n/en.tsx")).toBe(false)
  expect(isPageSource("features/x/utils/words.ts")).toBe(false)
})

test("findings group by check and language, errors first", () => {
  const groups = groupFindings([
    { check: "pluralForms", language: "es", where: "a", detail: "n: many" },
    { check: "missing", language: "fr", where: "a" },
    { check: "missing", language: "es", where: "a" },
    { check: "missing", language: "es", where: "b" },
    { check: "typedEnglish", where: "app/page.tsx:3" },
  ])
  expect(
    groups.map(({ check, language, severity, findings }) => [
      check,
      language,
      severity,
      findings.length,
    ])
  ).toEqual([
    ["missing", "es", "error", 2],
    ["missing", "fr", "error", 1],
    ["typedEnglish", undefined, "error", 1],
    ["pluralForms", "es", "warning", 1],
  ])
})

test("the database's interface words are read, not a business's texts", async () => {
  // Only this test's words (the migrations bring today's Spanish).
  await db.delete(translationEntries)
  await db.insert(translationEntries).values([
    {
      scope: "interface",
      module: "shop.title",
      key: "shop.title",
      language: "es",
      sourceText: "Bookings",
      sourceHash: "h1",
      text: "Reservas",
      status: "edited",
      origin: "manual",
    },
    {
      scope: "business",
      businessId: "biz",
      module: "service.name",
      key: "s1:service.name",
      language: "es",
      sourceText: "Haircut",
      sourceHash: "h2",
      text: "Corte",
      status: "automatic",
      origin: "google",
    },
  ])
  const rows = await interfaceTranslations()
  expect(rows).toEqual([
    {
      key: "shop.title",
      language: "es",
      text: "Reservas",
      status: "edited",
      origin: "manual",
      sourceText: "Bookings",
    },
  ])
  expect(
    checkTranslations({
      english: words({ shop: { title: "Bookings", empty: "No bookings" } }),
      rows,
      languages: ["es"],
    })
  ).toEqual([{ check: "missing", language: "es", where: "shop.empty" }])
})
