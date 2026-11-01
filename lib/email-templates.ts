import { ONBOARDING_RULES } from "./onboarding-rules"

export interface VerificationEmail {
  subject: string
  text: string
  html: string
}

// The sign-up confirmation email. Plain words and one link: no images,
// no tracking.
export function verificationEmail(url: string): VerificationEmail {
  const hours = ONBOARDING_RULES.emailVerificationHours
  const text =
    `Tap the link to confirm your email for Koblip Book:\n\n${url}\n\n` +
    `The link works for ${hours} hours. If you didn't sign up, ignore this email.`
  return {
    subject: "Confirm your email",
    text,
    html:
      `<p>Tap the link to confirm your email for Koblip Book:</p>` +
      `<p><a href="${url}">${url}</a></p>` +
      `<p>The link works for ${hours} hours. If you didn't sign up, ignore this email.</p>`,
  }
}

// Names in an email's HTML are text, never markup.
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

// A team member's link to connect their Google Calendar (G5 in
// docs/plans/google-calendar.md), in the owner's language. One link, no
// images, no tracking.
export function teamCalendarEmail(input: {
  businessName: string
  url: string
  days: number
  language: "en" | "es"
}): VerificationEmail {
  const { businessName, url, days } = input
  const words =
    input.language === "es"
      ? {
          subject: `Conecta tu Google Calendar a ${businessName}`,
          lead: `${businessName} te pide conectar tu Google Calendar: tus reservas aparecen ahí y tus horas ocupadas no se pueden reservar.`,
          note: `El enlace funciona ${days} días y solo una vez.`,
        }
      : {
          subject: `Connect your Google Calendar to ${businessName}`,
          lead: `${businessName} asks you to connect your Google Calendar: your bookings show up there, and your busy times can't be booked.`,
          note: `The link works for ${days} days, once.`,
        }
  return {
    subject: words.subject,
    text: `${words.lead}\n\n${url}\n\n${words.note}`,
    html:
      `<p>${escapeHtml(words.lead)}</p>` +
      `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` +
      `<p>${escapeHtml(words.note)}</p>`,
  }
}

// A team member's link to join their business with their own account
// (docs/plans/team-accounts.md), in the owner's language. One link, no
// images, no tracking.
export function teamInviteEmail(input: {
  businessName: string
  url: string
  days: number
  language: "en" | "es"
}): VerificationEmail {
  const { businessName, url, days } = input
  const words =
    input.language === "es"
      ? {
          subject: `Únete a ${businessName} en Koblip Book`,
          lead: `${businessName} te invita a tu propio espacio en Koblip Book: tus reservas, tu horario y tu perfil.`,
          note: `El enlace funciona ${days} días y solo una vez.`,
        }
      : {
          subject: `Join ${businessName} on Koblip Book`,
          lead: `${businessName} invites you to your own space on Koblip Book: your bookings, your hours and your profile.`,
          note: `The link works for ${days} days, once.`,
        }
  return {
    subject: words.subject,
    text: `${words.lead}\n\n${url}\n\n${words.note}`,
    html:
      `<p>${escapeHtml(words.lead)}</p>` +
      `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` +
      `<p>${escapeHtml(words.note)}</p>`,
  }
}
