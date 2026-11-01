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
  // The appointments and clients a team member had before Koblip, added to
  // the numbers on their profile. Each new team member starts with random
  // ones in this range (clients never more than appointments); they change
  // them, or set 0, in their Profile.
  startingCounts: { min: 470, max: 1950, highest: 999_999 },
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

export interface StartingCounts {
  pastAppointments: number
  pastClients: number
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// A new team member's starting numbers (TEAM_RULES.startingCounts).
export function randomStartingCounts(): StartingCounts {
  const { min, max } = TEAM_RULES.startingCounts
  const pastAppointments = randomBetween(min, max)
  return { pastAppointments, pastClients: randomBetween(min, pastAppointments) }
}

// Checks starting numbers sent from a form: whole numbers from 0, clients
// never more than appointments.
export function checkStartingCounts(
  input: Partial<StartingCounts> | null | undefined
): { ok: true; values: StartingCounts } | { ok: false; error: "counts" } {
  const { highest } = TEAM_RULES.startingCounts
  const pastAppointments = input?.pastAppointments
  const pastClients = input?.pastClients
  const fits = (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= highest
  if (!fits(pastAppointments) || !fits(pastClients) || pastClients > pastAppointments)
    return { ok: false, error: "counts" }
  return { ok: true, values: { pastAppointments, pastClients } }
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
