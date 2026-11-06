// @vitest-environment node
import { parse } from "@formatjs/icu-messageformat-parser"
import { createTranslator } from "next-intl"
import { expect, test } from "vitest"
import { sameIcuFields } from "./icu"
import { pseudoMessage, pseudoText, pseudoWords } from "./pseudo"

test("letters are accented and vowels doubled; the rest stays", () => {
  expect(pseudoText("Book now")).toBe("Ɓööööķ ñööŵ")
  expect(pseudoText("Ask 24/7 · 100%")).toBe("Åášķ 24/7 · 100%")
  // Letters already accented stay as they are.
  expect(pseudoText("Más")).toBe("Ṁáš")
})

test("only the words change: fields, plurals, selects and tags stay", () => {
  const messages = [
    "Hi {name}",
    "{count, plural, one {# booking} other {# bookings}}",
    "{kind, select, phone {Call {name}} other {Write}}",
    "Read the <link>terms</link> first",
    "It's {name}'s turn, from {price, number}",
    "{count}",
  ]
  for (const english of messages) {
    const pseudo = pseudoMessage(english)
    expect(sameIcuFields(english, pseudo)).toBe(true)
    expect(pseudo.startsWith("[")).toBe(true)
    expect(pseudo.endsWith("]")).toBe(true)
  }
  expect(pseudoMessage("Read the <link>terms</link> first")).toBe(
    "[Ŕééááð ţĥéé <link>ţééŕɱš</link> ƒîîŕšţ]"
  )
  const plural = parse(pseudoMessage("{count, plural, =0 {None} one {# day} other {# days}}"))
  expect(plural).toHaveLength(3)
  // The printer sorts the options; the same ones are there.
  expect(Object.keys((plural[1] as { options: object }).options).sort()).toEqual([
    "=0",
    "one",
    "other",
  ])
})

test("a sentence comes out about a third longer", () => {
  const english = "Your next booking starts in ten minutes"
  const pseudo = pseudoMessage(english)
  expect(pseudo.length / english.length).toBeGreaterThan(1.3)
})

test("a message that isn't ICU, and an empty one, stay as they are", () => {
  expect(pseudoMessage("Hi {name")).toBe("Hi {name")
  expect(pseudoMessage("")).toBe("")
})

test("a whole word tree keeps its keys, and next-intl formats it", () => {
  const english = {
    shop: {
      title: "Bookings",
      count: "{count, plural, one {# booking} other {# bookings}}",
    },
  }
  const pseudo = pseudoWords(english)
  expect(Object.keys(pseudo.shop)).toEqual(["title", "count"])
  const t = createTranslator({ locale: "en-US", messages: pseudo, namespace: "shop" })
  expect(t("title")).toBe("[Ɓööööķîîñĝš]")
  expect(t("count", { count: 2 })).toBe("[2 ƀööööķîîñĝš]")
})
