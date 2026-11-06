import "server-only"
import { createTranslator } from "next-intl"

import { ACCOUNT_RULES } from "./account-rules"
import { APP_NAME } from "./app-install"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { DEFAULT_LOCALES, type PageLanguage } from "./page-language"
import { wordsFor } from "./translations/interface-words"

export interface LinkEmail {
  subject: string
  text: string
  html: string
}

// Names and links in an email's HTML are text, never markup.
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

// Every email Koblip Book sends: plain words and one link. No images, no
// tracking.
function linkEmail(words: {
  subject: string
  lead: string
  url: string
  note: string
}): LinkEmail {
  const { subject, lead, url, note } = words
  return {
    subject,
    text: `${lead}\n\n${url}\n\n${note}`,
    html:
      `<p>${escapeHtml(lead)}</p>` +
      `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` +
      `<p>${escapeHtml(note)}</p>`,
  }
}

// An email's words (appServer.emails), in the language it goes out in.
// Emails also go out with no page behind them (sign-up, the team's
// invites), so the words come straight from the app's words, as a
// Google Calendar event's do (lib/google-calendar-event.ts).
async function emailWords(language: PageLanguage) {
  const messages = await wordsFor(language)
  return createTranslator({
    locale: DEFAULT_LOCALES[language],
    messages,
    namespace: "appServer.emails",
  })
}

// The sign-up confirmation email.
export async function verificationEmail(
  url: string,
  language: PageLanguage
): Promise<LinkEmail> {
  const t = await emailWords(language)
  return linkEmail({
    url,
    subject: t("verification.subject"),
    lead: t("verification.lead", { app: APP_NAME }),
    note: t("verification.note", {
      hours: ONBOARDING_RULES.emailVerificationHours,
    }),
  })
}

// The "Forgot password" email.
export async function resetPasswordEmail(
  url: string,
  language: PageLanguage
): Promise<LinkEmail> {
  const t = await emailWords(language)
  return linkEmail({
    url,
    subject: t("resetPassword.subject"),
    lead: t("resetPassword.lead", { app: APP_NAME }),
    note: t("resetPassword.note", {
      minutes: ACCOUNT_RULES.passwordResetMinutes,
    }),
  })
}

// A team member's link to connect their Google Calendar (G5 in
// docs/plans/google-calendar.md), in the owner's language.
export async function teamCalendarEmail(input: {
  businessName: string
  url: string
  days: number
  language: PageLanguage
}): Promise<LinkEmail> {
  const { businessName, url, days } = input
  const t = await emailWords(input.language)
  return linkEmail({
    url,
    subject: t("teamCalendar.subject", { businessName }),
    lead: t("teamCalendar.lead", { businessName }),
    note: t("teamCalendar.note", { days }),
  })
}

// A team member's link to join their business with their own account
// (docs/plans/team-accounts.md), in the owner's language.
export async function teamInviteEmail(input: {
  businessName: string
  url: string
  days: number
  language: PageLanguage
}): Promise<LinkEmail> {
  const { businessName, url, days } = input
  const t = await emailWords(input.language)
  return linkEmail({
    url,
    subject: t("teamInvite.subject", { businessName, app: APP_NAME }),
    lead: t("teamInvite.lead", { businessName, app: APP_NAME }),
    note: t("teamInvite.note", { days }),
  })
}
