// @vitest-environment node
import { createClient } from "@libsql/client"
import { expect, test } from "vitest"
import {
  billedCharacters,
  fromGoogleHtml,
  keepsProtectedParts,
  sourceHash,
  toGoogleHtml,
} from "./markup"

const KEEP = (text: string) => `<span translate="no">${text}</span>`

test("fields, links and emails go to Google marked to keep", () => {
  const { html, kept } = toGoogleHtml(
    "Hi {name}, see https://koblip.com/b/shop. Write to hello@shop.com"
  )
  expect(kept).toEqual(["{name}", "https://koblip.com/b/shop", "hello@shop.com"])
  expect(html).toBe(
    `Hi ${KEEP("{name}")}, see ${KEEP("https://koblip.com/b/shop")}. Write to ${KEEP("hello@shop.com")}`
  )
})

test("the kept parts come back as they were, in the translation's order", () => {
  const { kept } = toGoogleHtml("Hi {name}, your {service} is booked")
  expect(
    fromGoogleHtml(
      `Hola, tu ${KEEP("{service}")} está reservado, ${KEEP("{name}")}`,
      kept
    )
  ).toBe("Hola, tu {service} está reservado, {name}")
})

test("a missing, changed or extra kept part makes the answer unusable", () => {
  const { kept } = toGoogleHtml("Hi {name}")
  expect(fromGoogleHtml("Hola nombre", kept)).toBeNull()
  expect(fromGoogleHtml(`Hola ${KEEP("{nombre}")}`, kept)).toBeNull()
  expect(fromGoogleHtml(`Hola ${KEEP("{name}")} ${KEEP("{name}")}`, kept)).toBeNull()
})

test("brand names go to Google marked to keep, the longest name first", () => {
  const { html, kept } = toGoogleHtml(
    "Koblip Book's wording on WhatsApp and Google Calendar, by Koblip"
  )
  expect(kept).toEqual(["Koblip Book", "WhatsApp", "Google Calendar", "Koblip"])
  expect(html).toBe(
    `${KEEP("Koblip Book")}'s wording on ${KEEP("WhatsApp")} and ${KEEP("Google Calendar")}, by ${KEEP("Koblip")}`
  )
})

test("a brand is a whole word with its own capitals; links and emails stay whole", () => {
  expect(toGoogleHtml("Book a metadata check with google, Googlers or Metaverse").kept).toEqual([])
  expect(
    toGoogleHtml("Write to Koblip@shop.com or see https://shop.com/Koblip").kept
  ).toEqual(["Koblip@shop.com", "https://shop.com/Koblip"])
})

test("a lost or changed brand name makes the answer unusable", () => {
  const { kept } = toGoogleHtml("Koblip Book's wording")
  expect(fromGoogleHtml(`Texto do ${KEEP("Koblip Book")}`, kept)).toBe(
    "Texto do Koblip Book"
  )
  expect(fromGoogleHtml("Texto do livro", kept)).toBeNull()
  expect(fromGoogleHtml(`Texto do ${KEEP("Livro Koblip")}`, kept)).toBeNull()
})

test("an admin's own translation keeps fields, links and emails; brands are the admin's call", () => {
  expect(keepsProtectedParts("Hi {name}, on WhatsApp", "Hola {name}, por Whatsapp")).toBe(true)
  expect(keepsProtectedParts("Hi {name}, on WhatsApp", "Hola, por WhatsApp")).toBe(false)
})

test("line breaks travel as <br> and come back", () => {
  const { html, kept } = toGoogleHtml("Line one\nLine two")
  expect(html).toBe("Line one<br>Line two")
  expect(fromGoogleHtml("Línea uno <br /> Línea dos", kept)).toBe(
    "Línea uno\nLínea dos"
  )
})

test("special characters are escaped going and read back once", () => {
  const { html, kept } = toGoogleHtml(`Tom & Jerry's "<b>"`)
  expect(html).toBe("Tom &amp; Jerry's &quot;&lt;b&gt;&quot;")
  expect(
    fromGoogleHtml("Tom &amp; Jerry&#39;s &quot;&lt;b&gt;&quot; &amp;lt;", kept)
  ).toBe(`Tom & Jerry's "<b>" &lt;`)
})

test("an empty answer is unusable", () => {
  expect(fromGoogleHtml("  ", [])).toBeNull()
})

test("billed characters are code points, tags included", () => {
  expect(billedCharacters("ñ😀")).toBe(2)
  expect(billedCharacters("<br>")).toBe(4)
})

test("the same English has the same fingerprint", () => {
  expect(sourceHash("Haircut")).toBe(sourceHash("Haircut"))
  expect(sourceHash("Haircut")).not.toBe(sourceHash("Haircut "))
})

// Migrations fill fingerprints in SQL (drizzle/0056_move_translations.sql).
test("the database computes the same fingerprint", async () => {
  const client = createClient({ url: ":memory:" })
  for (const text of ["Haircut", "Corte clásico ✂️", "Line one\nline two"]) {
    const result = await client.execute({
      sql: "select lower(hex(sha3(?))) as hash",
      args: [text],
    })
    expect(result.rows[0]?.hash).toBe(sourceHash(text))
  }
  client.close()
})
