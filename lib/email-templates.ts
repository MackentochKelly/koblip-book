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
