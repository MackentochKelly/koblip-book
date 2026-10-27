export const PAGE_LANGUAGES = ["en", "es"] as const

export type PageLanguage = (typeof PAGE_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: PageLanguage = "en"

export function isPageLanguage(value: unknown): value is PageLanguage {
  return value === "en" || value === "es"
}

// The ?lang= value wins ("en" or "es", any other value is ignored); else the
// first Accept-Language entry (by q order) that is en or es (es-MX → es);
// else "en".
export function pickLanguage(
  param: string | string[] | undefined,
  acceptLanguage: string | null
): PageLanguage {
  if (typeof param === "string" && isPageLanguage(param)) {
    return param
  }
  if (Array.isArray(param)) {
    for (const value of param) {
      if (isPageLanguage(value)) {
        return value
      }
    }
  }
  if (acceptLanguage) {
    const ranked = acceptLanguage
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
        // Primary subtag only: es-MX → es.
        const primary = (tagPart ?? "")
          .trim()
          .split(/[-_]/)[0]
          ?.toLowerCase()
        return { primary, quality, index }
      })
      .sort((a, b) => b.quality - a.quality || a.index - b.index)
    for (const { primary } of ranked) {
      if (isPageLanguage(primary)) {
        return primary
      }
    }
  }
  return DEFAULT_LANGUAGE
}
