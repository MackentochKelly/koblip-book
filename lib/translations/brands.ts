// Brand names stay as they are in every language (docs/plans/translations.md,
// "Not translated"). Both paths to Google keep them as fields are kept, in a
// `<span translate="no">`, which Cloud Translation leaves untouched when the
// text goes as `text/html` ("How do I tell Cloud Translation - Advanced to
// not translate something?",
// https://docs.cloud.google.com/translate/troubleshooting, read 2026-11-06):
// business texts in ./markup.ts, the app's own words in ./icu.ts. A
// translation that loses or changes one is not used.
//
// Matched whole word and case-sensitive, so "book a table" or "metadata"
// never match; a longer name wins over the one inside it ("Koblip Book"
// over "Koblip"). Plain values only.
export const BRAND_NAMES = [
  "Koblip Book",
  "Koblip Chat",
  "Koblip",
  "WhatsApp",
  "Google Business Profile",
  "Google Calendar",
  "Google Search",
  "Google Maps",
  "Google",
  "Meta AI",
  "Meta",
  "Muse Voice Transcribe",
  "Muse Spark",
  "Muse Image",
  "Muse",
  "Instagram",
  "Facebook",
  "TikTok",
  "GitHub",
  "ElevenLabs",
  "iPhone",
  "iPad",
  "Android",
  "Gmail",
  "Cash App",
  "Zelle",
  "PayPal",
  "Venmo",
] as const

// The names, longest first, as one regular expression source for the `u`
// flag. Whole word: no letter or digit right before or after.
export const BRAND_PATTERN = `(?<![\\p{L}\\p{N}])(?:${[...BRAND_NAMES]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")})(?![\\p{L}\\p{N}])`

// Every brand name in a text, in order.
export function brandsIn(text: string): string[] {
  return [...text.matchAll(new RegExp(BRAND_PATTERN, "gu"))].map(
    (match) => match[0]
  )
}

// A translation keeps the English's brand names: each one, as often.
export function keepsBrands(english: string, translation: string): boolean {
  const left = brandsIn(english).sort()
  const right = brandsIn(translation).sort()
  return (
    left.length === right.length &&
    left.every((name, index) => name === right[index])
  )
}
