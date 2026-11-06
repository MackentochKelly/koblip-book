import { type MessageFormatElement, TYPE } from "@formatjs/icu-messageformat-parser"
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js"
import { parseIcu } from "./icu"

// A long made-up language to test layouts (docs/plans/translations.md, G6):
// "Book now" becomes "[Ɓööööķ ñööŵ]". Accented letters show a font that
// lacks them, doubled vowels make each word about a third longer (as
// Spanish, Portuguese and French often are), and the brackets show where a
// message is cut off or glued to another. Only the words change: fields,
// plurals, selects and tags stay as they are, so every page still works.
// Development only, with I18N_PSEUDO=1 (i18n/request.ts).

const PLAIN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const ACCENTED = "áƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ"
const ACCENT = new Map(
  Array.from(PLAIN, (letter, index) => [letter, ACCENTED[index]])
)
const VOWELS = new Set("aeiouAEIOU")

// One run of text: each letter accented, each vowel twice.
export function pseudoText(text: string): string {
  let out = ""
  for (const character of text) {
    const accented = ACCENT.get(character)
    if (!accented) {
      out += character
      continue
    }
    out += accented
    if (VOWELS.has(character)) {
      out += ACCENT.get(character.toLowerCase())
    }
  }
  return out
}

// One ICU message in the pseudo-language; a message that isn't ICU stays as
// it is (npm run i18n:check reports it).
export function pseudoMessage(message: string): string {
  const ast = message === "" ? null : parseIcu(message)
  if (!ast) return message
  const words = rewrite(ast)
  const first = words[0]
  if (first?.type === TYPE.literal) {
    words[0] = { ...first, value: `[${first.value}` }
  } else {
    words.unshift({ type: TYPE.literal, value: "[" })
  }
  const end = words.length - 1
  const last = words[end]
  if (last.type === TYPE.literal) {
    words[end] = { ...last, value: `${last.value}]` }
  } else {
    words.push({ type: TYPE.literal, value: "]" })
  }
  return printAST(words)
}

// Every word of a message tree (i18n/messages.ts) in the pseudo-language,
// with the same keys.
export function pseudoWords<T>(messages: T): T {
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return pseudoMessage(value)
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, walk(child)])
      )
    }
    return value
  }
  return walk(messages) as T
}

// A copy of the elements with their text rewritten.
function rewrite(elements: MessageFormatElement[]): MessageFormatElement[] {
  return elements.map((element) => {
    switch (element.type) {
      case TYPE.literal:
        return { ...element, value: pseudoText(element.value) }
      case TYPE.tag:
        return { ...element, children: rewrite(element.children) }
      case TYPE.plural:
      case TYPE.select:
        return {
          ...element,
          options: Object.fromEntries(
            Object.entries(element.options).map(([key, option]) => [
              key,
              { ...option, value: rewrite(option.value) },
            ])
          ),
        }
      default:
        return element
    }
  })
}
