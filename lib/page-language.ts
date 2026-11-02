export const PAGE_LANGUAGES = ["en", "es"] as const

export type PageLanguage = (typeof PAGE_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: PageLanguage = "en"

// Set by proxy.ts on every page request: the page's language, for <html lang>.
export const PAGE_LANGUAGE_HEADER = "x-page-language"

export function isPageLanguage(value: unknown): value is PageLanguage {
  return value === "en" || value === "es"
}

// The language a ?lang= value names ("en" or "es", the first one if
// repeated), or null when it names none.
export function languageParam(
  param: string | string[] | undefined
): PageLanguage | null {
  if (typeof param === "string") {
    return isPageLanguage(param) ? param : null
  }
  return param?.find(isPageLanguage) ?? null
}

// The ?lang= value wins ("en" or "es", any other value is ignored); else the
// first Accept-Language entry (by q order) that is en or es (es-MX → es);
// else "en".
export function pickLanguage(
  param: string | string[] | undefined,
  acceptLanguage: string | null
): PageLanguage {
  const linked = languageParam(param)
  if (linked) {
    return linked
  }
  for (const tag of rankedTags(acceptLanguage)) {
    // Primary subtag only: es-MX → es.
    const primary = tag.split("-")[0].toLowerCase()
    if (isPageLanguage(primary)) {
      return primary
    }
  }
  return DEFAULT_LANGUAGE
}

// Accept-Language tags by q order (ties keep their order), "_" read as "-".
function rankedTags(acceptLanguage: string | null): string[] {
  if (!acceptLanguage) return []
  return acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [tagPart, ...params] = entry.split(";")
      let quality = 1
      for (const p of params) {
        const match = /^\s*q\s*=\s*([0-9.]+)\s*$/.exec(p)
        if (match) {
          const parsed = Number(match[1])
          quality = Number.isFinite(parsed) ? parsed : 1
        }
      }
      return { tag: (tagPart ?? "").trim().replace(/_/g, "-"), quality, index }
    })
    .filter((entry) => entry.tag && entry.tag !== "*")
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.tag)
}

// How numbers, prices and dates read when the browser names no region.
export const DEFAULT_LOCALES: Record<PageLanguage, string> = {
  en: "en-US",
  es: "es-US",
}

// A language with a region (es-ES), or null when the tag is not one Intl
// formats.
function withRegion(language: string, region: string | undefined): string | null {
  if (!region) return null
  try {
    const [tag] = Intl.NumberFormat.supportedLocalesOf([`${language}-${region}`])
    return tag ?? null
  } catch {
    return null
  }
}

function regionOf(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag).region
  } catch {
    return undefined
  }
}

// The format for `language`, from the visitor's own region: the browser's
// tag for that language (es-ES: "1234 €"), else that language in the
// browser's first region (English on a Spanish phone: en-ES), else the
// language's default. Only the format changes, never the currency.
export function pickLocale(
  language: PageLanguage,
  acceptLanguage: string | null
): string {
  const tags = rankedTags(acceptLanguage)
  for (const tag of tags) {
    if (tag.split("-")[0].toLowerCase() !== language) continue
    const locale = withRegion(language, regionOf(tag))
    if (locale) return locale
  }
  for (const tag of tags) {
    const locale = withRegion(language, regionOf(tag))
    if (locale) return locale
  }
  return DEFAULT_LOCALES[language]
}
