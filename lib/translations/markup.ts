import { createHash } from "node:crypto"

// Texts go to Google as HTML (`text/html`), so the parts that must stay as
// they are can be marked `translate="no"`, which Google leaves untouched
// (https://docs.cloud.google.com/translate/troubleshooting). Kept as they
// are: fields like {name}, links and email addresses. Line breaks travel as
// <br>, since HTML treats a new line as a space.

// A field, a link (without the full stop or bracket after it) or an email.
const PROTECTED =
  /\{[A-Za-z0-9_.]+\}|https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

const KEEP_OPEN = '<span translate="no">'
const KEEP_CLOSE = "</span>"

export interface GoogleHtml {
  html: string
  // The kept parts, in order, to check the translation against.
  kept: string[]
}

export function toGoogleHtml(text: string): GoogleHtml {
  const kept: string[] = []
  let html = ""
  let last = 0
  for (const match of text.matchAll(PROTECTED)) {
    html += escapeText(text.slice(last, match.index))
    html += KEEP_OPEN + escapeHtml(match[0]) + KEEP_CLOSE
    kept.push(match[0])
    last = match.index + match[0].length
  }
  html += escapeText(text.slice(last))
  return { html, kept }
}

// The plain text of Google's answer, or null when a kept part is missing,
// changed or added (the translation is then not used).
export function fromGoogleHtml(html: string, kept: string[]): string | null {
  const found: string[] = []
  const marked = html.replace(
    /<span\s+translate\s*=\s*["']?no["']?\s*>([\s\S]*?)<\/span>/gi,
    (_, inner: string) => {
      found.push(decodeEntities(inner))
      return `\u0000${found.length - 1}\u0000`
    }
  )
  if (!sameParts(found, kept)) {
    return null
  }
  const text = decodeEntities(
    marked.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
  )
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => found[Number(index)])
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim()
  return text === "" ? null : text
}

// Characters Google bills for a request text: every code point, tags and
// spaces too (https://cloud.google.com/translate/pricing).
export function billedCharacters(html: string): number {
  return [...html].length
}

// The English text's fingerprint: same text, same fingerprint. SHA3-256,
// because the database computes the same one itself (libSQL's `sha3()`), so
// a migration can fill it in: lower(hex(sha3(text))).
export function sourceHash(text: string): string {
  return createHash("sha3-256").update(text, "utf8").digest("hex")
}

function sameParts(found: string[], kept: string[]): boolean {
  if (found.length !== kept.length) {
    return false
  }
  const left = [...found].sort()
  const right = [...kept].sort()
  return left.every((part, index) => part === right[index])
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeText(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>")
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

// One pass, so "&amp;lt;" becomes "&lt;", not "<".
function decodeEntities(text: string): string {
  return text.replace(
    /&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, name: string) => {
      const lower = name.toLowerCase()
      if (lower.startsWith("#x")) {
        return safeCodePoint(parseInt(lower.slice(2), 16), entity)
      }
      if (lower.startsWith("#")) {
        return safeCodePoint(parseInt(lower.slice(1), 10), entity)
      }
      return NAMED[lower] ?? entity
    }
  )
}

function safeCodePoint(code: number, fallback: string): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : fallback
}
