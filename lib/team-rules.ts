import { BOOKING_RULES } from "./booking-rules"

// Team members' own accounts and public profiles
// (docs/plans/team-accounts.md).
export const TEAM_RULES = {
  // A team member's link to join with their own account works this long.
  inviteDays: 7,
  // Characters in a team member's About.
  aboutMaxLength: 600,
  // Languages a team member can list.
  maxLanguages: 6,
  // Languages offered in the picker (ISO 639-1); each is named in the
  // reader's own language with Intl.DisplayNames.
  languages: [
    "es", "en", "fr", "pt", "it", "de", "nl", "ca", "ht", "ru", "uk", "pl",
    "ro", "ar", "he", "tr", "hi", "zh", "ja", "ko", "vi", "tl",
  ],
} as const

export type TeamLanguage = (typeof TEAM_RULES.languages)[number]

export function isTeamLanguage(value: unknown): value is TeamLanguage {
  return (TEAM_RULES.languages as readonly unknown[]).includes(value)
}

// A language code's name in the reader's language ("es" → "Spanish").
export function languageName(code: string, inLanguage: string): string {
  try {
    const name = new Intl.DisplayNames([inLanguage], { type: "language" }).of(code)
    return name ? name.charAt(0).toLocaleUpperCase(inLanguage) + name.slice(1) : code
  } catch {
    return code
  }
}

// What customers see on a team member's profile; the owner and the team
// member both edit it.
export interface TeamProfile {
  description: string | null // their job title
  about: string | null
  languages: string[]
}

// Trimmed text, null when empty; undefined when it is not text at all.
function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return undefined
  return value.trim() === "" ? null : value.trim()
}

// Checks a profile sent from a form. The error names the field that is wrong.
export function checkTeamProfile(
  input: Partial<TeamProfile> | null | undefined
):
  | { ok: true; values: TeamProfile }
  | { ok: false; error: "description" | "about" | "languages" } {
  const description = optionalText(input?.description)
  if (
    description === undefined ||
    (description !== null && description.length > BOOKING_RULES.maxTeamDescription)
  )
    return { ok: false, error: "description" }
  const about = optionalText(input?.about)
  if (about === undefined || (about !== null && about.length > TEAM_RULES.aboutMaxLength))
    return { ok: false, error: "about" }
  const languages = input?.languages ?? []
  if (
    !Array.isArray(languages) ||
    languages.length > TEAM_RULES.maxLanguages ||
    !languages.every(isTeamLanguage)
  )
    return { ok: false, error: "languages" }
  return { ok: true, values: { description, about, languages: [...new Set(languages)] } }
}
