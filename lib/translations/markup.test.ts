// @vitest-environment node
import { expect, test } from "vitest"
import {
  billedCharacters,
  fromGoogleHtml,
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
