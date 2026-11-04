import { expect, test } from "vitest"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { ACCOUNT_RULES } from "./account-rules"
import { APP_NAME } from "./app-install"
import {
  resetPasswordEmail,
  teamCalendarEmail,
  teamInviteEmail,
  verificationEmail,
} from "./email-templates"

test("verificationEmail carries the link, the hours and no tracking", () => {
  const url =
    "http://localhost:3100/api/auth/verify-email?token=abc&callbackURL=%2F"
  const email = verificationEmail(url, "en")

  expect(email.subject).toBe("Confirm your email")
  expect(email.text).toContain(url)
  expect(email.text).toContain(
    `The link works for ${ONBOARDING_RULES.emailVerificationHours} hours.`
  )
  expect(email.text).toContain("24")
  const escaped = url.replaceAll("&", "&amp;")
  expect(email.html).toContain(`<a href="${escaped}">${escaped}</a>`)
  expect(email.html).toContain("24")
  expect(email.html).not.toContain("<img")
})

test("the team calendar email names the business as text, in the owner's language", () => {
  const email = teamCalendarEmail({
    businessName: "Ana <b>& Co</b>",
    url: "https://book.example.com/team-calendar/abc",
    days: 7,
    language: "es",
  })
  expect(email.subject).toBe("Conecta tu Google Calendar a Ana <b>& Co</b>")
  expect(email.html).toContain("Ana &lt;b&gt;&amp; Co&lt;/b&gt;")
  expect(email.html).not.toContain("<b>")
  expect(email.text).toContain("https://book.example.com/team-calendar/abc")
})

test("the confirmation email speaks Spanish on a Spanish screen", () => {
  const email = verificationEmail("https://book.example.com/verify", "es")
  expect(email.subject).toBe("Confirma tu correo")
  expect(email.text).toContain(
    `El enlace funciona ${ONBOARDING_RULES.emailVerificationHours} horas.`
  )
})

test.each([
  ["en", "Choose a new password", `The link works for ${ACCOUNT_RULES.passwordResetMinutes} minutes, once.`],
  ["es", "Elige una contraseña nueva", `El enlace funciona ${ACCOUNT_RULES.passwordResetMinutes} minutos y solo una vez.`],
] as const)("the %s password email carries the link and how long it works", (language, subject, note) => {
  const url = "https://book.example.com/api/auth/reset-password/abc?callbackURL=%2Freset-password"
  const email = resetPasswordEmail(url, language)
  expect(email.subject).toBe(subject)
  expect(email.text).toContain(url)
  expect(email.text).toContain(note)
  expect(email.text).toContain(APP_NAME)
  expect(email.html).toContain(`<a href="${url}">`)
  expect(email.html).not.toContain("<img")
})

test("the team invite email takes the app's name from one place", () => {
  const email = teamInviteEmail({
    businessName: "Ana & Co",
    url: "https://book.example.com/invite/abc",
    days: 7,
    language: "en",
  })
  expect(email.subject).toBe(`Join Ana & Co on ${APP_NAME}`)
  expect(email.html).toContain("Ana &amp; Co")
})
