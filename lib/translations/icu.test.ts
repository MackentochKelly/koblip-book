import { expect, test } from "vitest"
import { sameIcuFields, toGoogleIcu } from "./icu"

// Google stand-in: upper-cases the words and keeps every tag.
const shout = (html: string) =>
  html.replace(/(^|>)([^<]*)/g, (_, end: string, text: string) => end + text.toUpperCase())

test("plain words go as one text and come back as they are", () => {
  const icu = toGoogleIcu("Book now")!
  expect(icu.htmls).toEqual(["Book now"])
  expect(icu.assemble(["Reservar"])).toBe("Reservar")
})

test("fields are kept; Google may move them", () => {
  const icu = toGoogleIcu("Photo {index} of {total}")!
  expect(icu.htmls).toEqual([
    'Photo <span translate="no">{index}</span> of <span translate="no">{total}</span>',
  ])
  expect(
    icu.assemble(['<span translate="no">{total}</span> fotos, la <span translate="no">{index}</span>'])
  ).toBe("{total} fotos, la {index}")
  // A lost or changed field: not used.
  expect(icu.assemble(['Foto <span translate="no">{index}</span>'])).toBeNull()
  expect(icu.assemble(['Foto <span translate="no">{indice}</span> de <span translate="no">{total}</span>'])).toBeNull()
})

test("each plural option goes on its own; the frame stays", () => {
  const icu = toGoogleIcu("{count, plural, one {# review} other {# reviews}}")!
  expect(icu.htmls).toEqual([
    '<span translate="no">#</span> review',
    '<span translate="no">#</span> reviews',
  ])
  expect(
    icu.assemble(['<span translate="no">#</span> reseña', '<span translate="no">#</span> reseñas'])
  ).toBe("{count,plural,one{# reseña} other{# reseñas}}")
})

test("tags travel as spans; their words are translated", () => {
  const icu = toGoogleIcu("Read the <link>terms</link> first")!
  expect(icu.htmls).toEqual(['Read the <span data-t="0">terms</span> first'])
  expect(icu.assemble([shout(icu.htmls[0])])).toBe("READ THE <link>TERMS</link> FIRST")
  expect(icu.assemble(["Read the terms first"])).toBeNull()
})

test("characters ICU reads as syntax come back escaped", () => {
  const icu = toGoogleIcu("It's {name}'s turn")!
  const back = icu.assemble([
    'C\'est le tour de <span translate="no">{name}</span> {ici}',
  ])
  expect(back).not.toBeNull()
  expect(sameIcuFields("It's {name}'s turn", back!)).toBe(true)
})

test("a translation must have the English's fields with the same types", () => {
  expect(sameIcuFields("Hi {name}", "Hola {name}")).toBe(true)
  expect(sameIcuFields("Hi {name}", "Hola")).toBe(false)
  expect(sameIcuFields("{n, plural, other {# x}}", "{n} x")).toBe(false)
  expect(sameIcuFields("Hi {name}", "Hola {name")).toBe(false)
})

test("words around a plural go inside each option, as whole sentences", () => {
  const icu = toGoogleIcu("Based on {n, plural, one {# booking} other {# bookings}}")!
  expect(icu.htmls).toEqual([
    'Based on <span translate="no">#</span> booking',
    'Based on <span translate="no">#</span> bookings',
  ])
})

test("a run's own spaces stay, even when Google drops them", () => {
  const icu = toGoogleIcu("{n, plural, other {# x}} and more")!
  const back = icu.assemble(icu.htmls.map((html) => html.trim()))
  expect(back).not.toBeNull()
  expect(sameIcuFields("{n, plural, other {# x}} and more", back!)).toBe(true)
})

test("an empty answer, a plural inside a tag or a field with two types can't break anything", () => {
  expect(toGoogleIcu("Book now")!.assemble([""])).toBeNull()
  expect(toGoogleIcu("You have <b>{n, plural, other {# x}}</b>")).toBeNull()
  expect(sameIcuFields("{n} {n, number}", "{n}")).toBe(false)
})

test("an empty tag travels as a kept part", () => {
  const icu = toGoogleIcu("Saved <icon></icon> now")!
  expect(icu.htmls).toEqual(['Saved <span translate="no">&lt;icon&gt;&lt;/icon&gt;</span> now'])
  expect(icu.assemble(['Guardado <span translate="no">&lt;icon&gt;&lt;/icon&gt;</span> ya'])).toBe(
    "Guardado <icon></icon> ya"
  )
})
