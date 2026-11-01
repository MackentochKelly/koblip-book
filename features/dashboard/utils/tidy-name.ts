// Lowercase words without accents or symbols: "Barbería NEAR ME™" →
// ["barberia", "near", "me"].
function words(name: string): string[] {
  return name
    // Symbols first: NFKD would turn ™ into the letters "TM".
    .replace(/\p{S}/gu, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

// The name before a slogan or place added after a separator:
// "milk + honey | Downtown Austin" → "milk + honey".
function core(name: string): string {
  return name.split(/\s*\|\s*|\s+[-–—·:]\s+/)[0]
}

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((word, index) => word === b[index])

// True when `tidied` is the same business name, only cleaned: other
// capitals, no symbols, and maybe without what follows a separator. Every
// word of the name itself stays, in order; nothing is added or translated.
// Muse's suggestion is used only when this holds.
export function isTidiedName(original: string, tidied: string): boolean {
  const kept = words(tidied)
  return (
    kept.length > 0 &&
    (same(kept, words(original)) || same(kept, words(core(original))))
  )
}
