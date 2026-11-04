import { ACCOUNT_RULES } from "./account-rules"
import { APP_NAME } from "./app-install"
import { ONBOARDING_RULES } from "./onboarding-rules"
import type { PageLanguage } from "./page-language"

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

// The sign-up confirmation email.
export function verificationEmail(
  url: string,
  language: PageLanguage
): LinkEmail {
  const hours = ONBOARDING_RULES.emailVerificationHours
  return linkEmail({
    url,
    ...(language === "es"
      ? {
          subject: "Confirma tu correo",
          lead: `Toca el enlace para confirmar tu correo en ${APP_NAME}:`,
          note: `El enlace funciona ${hours} horas. Si no te registraste, ignora este correo.`,
        }
      : {
          subject: "Confirm your email",
          lead: `Tap the link to confirm your email for ${APP_NAME}:`,
          note: `The link works for ${hours} hours. If you didn't sign up, ignore this email.`,
        }),
  })
}

// The "Forgot password" email.
export function resetPasswordEmail(
  url: string,
  language: PageLanguage
): LinkEmail {
  const minutes = ACCOUNT_RULES.passwordResetMinutes
  return linkEmail({
    url,
    ...(language === "es"
      ? {
          subject: "Elige una contraseña nueva",
          lead: `Toca el enlace para elegir una contraseña nueva en ${APP_NAME}:`,
          note: `El enlace funciona ${minutes} minutos y solo una vez. Si no lo pediste, ignora este correo.`,
        }
      : {
          subject: "Choose a new password",
          lead: `Tap the link to choose a new password for ${APP_NAME}:`,
          note: `The link works for ${minutes} minutes, once. If you didn't ask for it, ignore this email.`,
        }),
  })
}

// A team member's link to connect their Google Calendar (G5 in
// docs/plans/google-calendar.md), in the owner's language.
export function teamCalendarEmail(input: {
  businessName: string
  url: string
  days: number
  language: PageLanguage
}): LinkEmail {
  const { businessName, url, days } = input
  return linkEmail({
    url,
    ...(input.language === "es"
      ? {
          subject: `Conecta tu Google Calendar a ${businessName}`,
          lead: `${businessName} te pide conectar tu Google Calendar: tus reservas aparecen ahí y tus horas ocupadas no se pueden reservar.`,
          note: `El enlace funciona ${days} días y solo una vez.`,
        }
      : {
          subject: `Connect your Google Calendar to ${businessName}`,
          lead: `${businessName} asks you to connect your Google Calendar: your bookings show up there, and your busy times can't be booked.`,
          note: `The link works for ${days} days, once.`,
        }),
  })
}

// A team member's link to join their business with their own account
// (docs/plans/team-accounts.md), in the owner's language.
export function teamInviteEmail(input: {
  businessName: string
  url: string
  days: number
  language: PageLanguage
}): LinkEmail {
  const { businessName, url, days } = input
  return linkEmail({
    url,
    ...(input.language === "es"
      ? {
          subject: `Únete a ${businessName} en ${APP_NAME}`,
          lead: `${businessName} te invita a tu propio espacio en ${APP_NAME}: tus reservas, tu horario y tu perfil.`,
          note: `El enlace funciona ${days} días y solo una vez.`,
        }
      : {
          subject: `Join ${businessName} on ${APP_NAME}`,
          lead: `${businessName} invites you to your own space on ${APP_NAME}: your bookings, your hours and your profile.`,
          note: `The link works for ${days} days, once.`,
        }),
  })
}
