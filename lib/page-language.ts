// The app's languages (docs/plans/translations.md, Language scope): English
// first, then the ones Google translates it into.
export const PAGE_LANGUAGES = ["en", "es", "pt", "fr"] as const

export type PageLanguage = (typeof PAGE_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: PageLanguage = "en"

// Each language named in itself, as Airbnb and Booking.com do: every
// language menu and list shows these, never a translated name.
export const LANGUAGE_NAMES: Record<PageLanguage, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
}

// Set by proxy.ts on every page request: the page's language, for <html lang>.
export const PAGE_LANGUAGE_HEADER = "x-page-language"

// The owner's pick, remembered on this device for a year. Without one, the
// phone's language (Accept-Language), else English.
export const OWNER_LANGUAGE_COOKIE = "owner-lang"
// How long the app's language pick is remembered on this device: a year.
export const OWNER_LANGUAGE_MAX_AGE = 60 * 60 * 24 * 365

export function isPageLanguage(value: unknown): value is PageLanguage {
  return (PAGE_LANGUAGES as readonly unknown[]).includes(value)
}

// The page language a format locale is in ("es-ES" → "es"), else English.
// next-intl's locale is the format one (pickLocale), so a page's language
// is `languageOf(useLocale())`.
export function languageOf(locale: string): PageLanguage {
  const primary = locale.split("-")[0].toLowerCase()
  return isPageLanguage(primary) ? primary : DEFAULT_LANGUAGE
}

// The language a ?lang= value names (one of PAGE_LANGUAGES, the first one
// if repeated), or null when it names none.
export function languageParam(
  param: string | string[] | undefined
): PageLanguage | null {
  if (typeof param === "string") {
    return isPageLanguage(param) ? param : null
  }
  return param?.find(isPageLanguage) ?? null
}

// The ?lang= value wins (one of PAGE_LANGUAGES, any other value is
// ignored); else the first Accept-Language entry (by q order) in one of
// them, whatever its region (es-MX → es, pt-PT → pt, fr-CA → fr); else "en".
export function pickLanguage(
  param: string | string[] | undefined,
  acceptLanguage: string | null
): PageLanguage {
  const linked = languageParam(param)
  if (linked) {
    return linked
  }
  for (const tag of rankedTags(acceptLanguage)) {
    // Primary subtag only: es-MX → es, pt-PT → pt.
    const primary = tag.split("-")[0].toLowerCase()
    if (isPageLanguage(primary)) {
      return primary
    }
  }
  return DEFAULT_LANGUAGE
}

// The owner area's language when no link names one: the one picked on this
// device, else the phone's, else English.
export function pickOwnerLanguage(
  picked: string | undefined,
  acceptLanguage: string | null
): PageLanguage {
  return isPageLanguage(picked)
    ? picked
    : pickLanguage(undefined, acceptLanguage)
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

// How numbers, prices and dates read when the browser names no region
// (docs/plans/translations.md, Language scope).
export const DEFAULT_LOCALES: Record<PageLanguage, string> = {
  en: "en-US",
  es: "es-US",
  pt: "pt-BR",
  fr: "fr-FR",
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
// tag for that language (es-ES: "1234 €", pt-PT, fr-CA), else that language
// in the browser's first region (English on a Spanish phone: en-ES), else
// the language's default. Only the format changes, never the currency.
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
