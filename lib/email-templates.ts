import "server-only"
import { createTranslator } from "next-intl"

import { ACCOUNT_RULES } from "./account-rules"
import { APP_NAME } from "./app-install"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { renderEmail, type EmailBody } from "./email-layout"
import { DEFAULT_LOCALES, type PageLanguage } from "./page-language"
import { wordsFor } from "./translations/interface-words"

export interface LinkEmail extends EmailBody {
  subject: string
}

// An email about one link (sign-up, password, an invite, the plan): the
// shared layout with the link as its one button (docs/plans/email.md,
// EM-D12). The title is the subject.
function linkEmail(words: {
  heading: string
  subject: string
  lead: string
  button: string
  url: string
  note: string
}): LinkEmail {
  const { heading, subject, lead, button, url, note } = words
  return {
    subject,
    ...renderEmail({
      heading,
      title: subject,
      lead,
      button: { label: button, url },
      note,
    }),
  }
}

// An email's words (appServer.emails), in the language it goes out in.
// Emails also go out with no page behind them (sign-up, the team's
// invites), so the words come straight from the app's words, as a
// Google Calendar event's do (lib/google-calendar-event.ts).
export async function emailWords(language: PageLanguage) {
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
    heading: APP_NAME,
    button: t("verification.button"),
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
    heading: APP_NAME,
    button: t("resetPassword.button"),
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
    heading: businessName,
    button: t("teamCalendar.button"),
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
    heading: businessName,
    button: t("teamInvite.button"),
    subject: t("teamInvite.subject", { businessName, app: APP_NAME }),
    lead: t("teamInvite.lead", { businessName, app: APP_NAME }),
    note: t("teamInvite.note", { days }),
  })
}

// The owner's card wasn't charged for Pro (docs/plans/subscriptions.md, P6):
// the link opens the business's Settings → Plan.
export async function paymentFailedEmail(input: {
  businessName: string
  url: string
  language: PageLanguage
}): Promise<LinkEmail> {
  const { businessName, url } = input
  const t = await emailWords(input.language)
  return linkEmail({
    url,
    heading: APP_NAME,
    button: t("paymentFailed.button"),
    subject: t("paymentFailed.subject", { businessName }),
    lead: t("paymentFailed.lead", { businessName }),
    note: t("paymentFailed.note", { businessName }),
  })
}

// A business's Pro plan ended, so it's on Free (P6).
export async function backToFreeEmail(input: {
  businessName: string
  url: string
  language: PageLanguage
}): Promise<LinkEmail> {
  const { businessName, url } = input
  const t = await emailWords(input.language)
  return linkEmail({
    url,
    heading: APP_NAME,
    button: t("backToFree.button"),
    subject: t("backToFree.subject", { businessName }),
    lead: t("backToFree.lead", { businessName }),
    note: t("backToFree.note"),
  })
}
