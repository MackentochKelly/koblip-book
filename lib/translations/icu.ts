import {
  isStructurallySame,
  type MessageFormatElement,
  parse,
  TYPE,
} from "@formatjs/icu-messageformat-parser"
import { hoistSelectors } from "@formatjs/icu-messageformat-parser/manipulator.js"
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js"
import { decodeEntities, escapeHtml, escapeText } from "./markup"

// The app's own words are ICU messages (next-intl,
// docs/plans/translations.md G4): "{count, plural, one {# booking} other
// {# bookings}}". Google gets only their sentences: plurals and selects are
// first lifted to the front (formatjs's hoistSelectors), so each option is a
// whole sentence ("Based on # booking"); each option's words go as their own
// HTML text, fields kept with `translate="no"` and tags as marked spans; the
// plural and select frame stays as it is, and the answer is put back into
// it. A translation is used
// only when it has the English's fields with the same types
// (`isStructurallySame`, formatjs's own check).

const KEEP = 'translate="no"'

// Parses an ICU message, or null when it isn't one.
export function parseIcu(text: string): MessageFormatElement[] | null {
  try {
    return parse(text)
  } catch {
    return null
  }
}

// A translation can stand in for the English: both parse, and they have
// the same fields with the same types.
export function sameIcuFields(english: string, translation: string): boolean {
  const source = parseIcu(english)
  const target = parseIcu(translation)
  if (!source || !target) return false
  // formatjs throws when one field has two types ({n} and {n, number}).
  try {
    return isStructurallySame(source, target).success
  } catch {
    return false
  }
}

export interface IcuGoogle {
  // One HTML text per run of words, for Google.
  htmls: string[]
  // The translation from Google's answers (in the same order), or null when
  // one is missing, changed a field, or the result isn't the English's
  // shape.
  assemble(answers: string[]): string | null
}

// What a run's HTML is made from, kept to read Google's answer back.
interface Run {
  // The fields, in the order the HTML has them ("{name}", "#").
  kept: MessageFormatElement[]
  // The tags (<link>…</link>), by their index in the HTML.
  tags: string[]
  // The spaces at the run's ends, which Google may drop.
  lead: string
  trail: string
}

// Splits an ICU message for Google. Null when the message isn't ICU.
export function toGoogleIcu(text: string): IcuGoogle | null {
  const ast = parseIcu(text)
  if (!ast) return null
  const htmls: string[] = []
  const runs: Run[] = []
  // The frame: the message with each run replaced by its index.
  // A plural inside a tag can't be split: the word fails, not the queue.
  let frame: FrameElement[]
  try {
    frame = splitRuns(hoistSelectors(ast), htmls, runs)
  } catch {
    return null
  }
  return {
    htmls,
    assemble(answers) {
      if (answers.length !== htmls.length) return null
      const parts: MessageFormatElement[][] = []
      for (let index = 0; index < answers.length; index++) {
        const read = readRun(answers[index], runs[index])
        if (!read) return null
        parts.push(read)
      }
      const translated = printAST(fillFrame(frame, parts))
      return sameIcuFields(text, translated) ? translated : null
    },
  }
}

// A run's place in the frame.
interface RunSlot {
  run: number
}

type FrameElement = MessageFormatElement | RunSlot

function isSlot(element: FrameElement): element is RunSlot {
  return "run" in element
}

function isRunElement(element: MessageFormatElement): boolean {
  return element.type !== TYPE.plural && element.type !== TYPE.select
}

// Elements in order, with each run of words (text, fields, tags) replaced
// by a slot; plurals and selects keep their place with their options split
// the same way. A run of only spaces or fields stays as it is.
function splitRuns(
  elements: MessageFormatElement[],
  htmls: string[],
  runs: Run[]
): FrameElement[] {
  const frame: FrameElement[] = []
  let current: MessageFormatElement[] = []
  const flush = () => {
    if (current.length === 0) return
    if (hasWords(current)) {
      const first = current[0]
      const last = current[current.length - 1]
      const run: Run = {
        kept: [],
        tags: [],
        lead: first.type === TYPE.literal ? /^\s*/.exec(first.value)![0] : "",
        trail: last.type === TYPE.literal ? /\s*$/.exec(last.value)![0] : "",
      }
      htmls.push(runHtml(current, run))
      runs.push(run)
      frame.push({ run: runs.length - 1 })
    } else {
      frame.push(...current)
    }
    current = []
  }
  for (const element of elements) {
    if (isRunElement(element)) {
      current.push(element)
      continue
    }
    flush()
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      const options: Record<string, { value: MessageFormatElement[] }> = {}
      for (const [key, option] of Object.entries(element.options)) {
        options[key] = {
          ...option,
          value: splitRuns(option.value, htmls, runs) as MessageFormatElement[],
        }
      }
      frame.push({ ...element, options } as MessageFormatElement)
    }
  }
  flush()
  return frame
}

function hasWords(elements: MessageFormatElement[]): boolean {
  return elements.some(
    (element) =>
      (element.type === TYPE.literal && /\p{L}/u.test(element.value)) ||
      (element.type === TYPE.tag && hasWords(element.children))
  )
}

function runHtml(elements: MessageFormatElement[], run: Run): string {
  let html = ""
  for (const element of elements) {
    if (element.type === TYPE.literal) {
      html += escapeText(element.value)
    } else if (element.type === TYPE.tag && hasWords(element.children)) {
      run.tags.push(element.value)
      html += `<span data-t="${run.tags.length - 1}">${runHtml(element.children, run)}</span>`
    } else if (element.type === TYPE.plural || element.type === TYPE.select) {
      // A plural inside a tag: never split, Google can't keep its frame.
      throw new Error("A plural or select inside a tag can't be translated")
    } else {
      run.kept.push(element)
      html += `<span ${KEEP}>${escapeHtml(printAST([element]))}</span>`
    }
  }
  return html
}

// Google's answer as ICU elements, or null when it lost, added or changed a
// field or tag.
function readRun(html: string, run: Run): MessageFormatElement[] | null {
  if (html.replace(/<[^>]*>/g, "").trim() === "") return null
  const tokens = html.split(/(<span\b[^>]*>|<\/span>|<br\s*\/?>)/i)
  // The open tags and fields so far; the last one gets the text.
  const stack: { children: MessageFormatElement[]; tag: string | null }[] = [
    { children: [], tag: null },
  ]
  const usedFields: string[] = []
  const usedTags = new Set<number>()
  let inField: MessageFormatElement | null = null
  let fieldText = ""
  const keptByText = new Map(run.kept.map((element) => [printAST([element]), element]))
  for (const token of tokens) {
    if (token === "") continue
    const top = stack[stack.length - 1]
    if (/^<span\b/i.test(token)) {
      if (/translate\s*=\s*["']?no/i.test(token)) {
        if (inField) return null
        inField = run.kept[0] ?? null
        if (!inField) return null
        fieldText = ""
        continue
      }
      const tag = /data-t\s*=\s*["']?(\d+)/i.exec(token)
      if (!tag) return null
      const index = Number(tag[1])
      if (usedTags.has(index) || index >= run.tags.length) return null
      usedTags.add(index)
      stack.push({ children: [], tag: run.tags[index] })
      continue
    }
    if (/^<\/span>$/i.test(token)) {
      if (inField) {
        const element = keptByText.get(decodeEntities(fieldText))
        if (!element) return null
        usedFields.push(printAST([element]))
        top.children.push(element)
        inField = null
        continue
      }
      if (stack.length === 1) return null
      const closed = stack.pop()!
      stack[stack.length - 1].children.push({
        type: TYPE.tag,
        value: closed.tag!,
        children: closed.children,
      } as MessageFormatElement)
      continue
    }
    if (/^<br/i.test(token)) {
      if (inField) return null
      pushText(top.children, "\n")
      continue
    }
    if (inField) {
      fieldText += token
      continue
    }
    pushText(top.children, decodeEntities(token.replace(/<[^>]*>/g, "")))
  }
  if (inField || stack.length !== 1) return null
  if (usedTags.size !== run.tags.length) return null
  const expected = run.kept.map((element) => printAST([element])).sort()
  if (usedFields.sort().join("\u0000") !== expected.join("\u0000")) return null
  return withEdges(stack[0].children, run)
}

// The run's own spaces at its ends, whatever Google did with them.
function withEdges(
  children: MessageFormatElement[],
  run: Run
): MessageFormatElement[] {
  const out = [...children]
  const first = out[0]
  if (first?.type === TYPE.literal) {
    out[0] = { ...first, value: first.value.replace(/^\s+/, "") }
  }
  const lastIndex = out.length - 1
  const last = out[lastIndex]
  if (last?.type === TYPE.literal) {
    out[lastIndex] = { ...last, value: last.value.replace(/\s+$/, "") }
  }
  if (run.lead) out.unshift({ type: TYPE.literal, value: run.lead } as MessageFormatElement)
  if (run.trail) out.push({ type: TYPE.literal, value: run.trail } as MessageFormatElement)
  return out.filter((element) => element.type !== TYPE.literal || element.value !== "")
}

function pushText(children: MessageFormatElement[], text: string) {
  if (text === "") return
  const last = children[children.length - 1]
  if (last?.type === TYPE.literal) {
    last.value += text
  } else {
    children.push({ type: TYPE.literal, value: text } as MessageFormatElement)
  }
}

function fillFrame(
  frame: FrameElement[],
  parts: MessageFormatElement[][]
): MessageFormatElement[] {
  const out: MessageFormatElement[] = []
  for (const element of frame) {
    if (isSlot(element)) {
      out.push(...parts[element.run])
    } else if (element.type === TYPE.plural || element.type === TYPE.select) {
      const options: Record<string, { value: MessageFormatElement[] }> = {}
      for (const [key, option] of Object.entries(element.options)) {
        options[key] = { ...option, value: fillFrame(option.value as FrameElement[], parts) }
      }
      out.push({ ...element, options } as MessageFormatElement)
    } else {
      out.push(element)
    }
  }
  // Text pieces next to each other read as one.
  return out.reduce<MessageFormatElement[]>((merged, element) => {
    const last = merged[merged.length - 1]
    if (element.type === TYPE.literal && last?.type === TYPE.literal) {
      merged[merged.length - 1] = { ...last, value: last.value + element.value }
    } else {
      merged.push(element)
    }
    return merged
  }, [])
}
