import { expect, test, vi } from "vitest"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { ACCOUNT_RULES } from "./account-rules"
import { APP_NAME } from "./app-install"
import {
  resetPasswordEmail,
  teamCalendarEmail,
  teamInviteEmail,
  verificationEmail,
} from "./email-templates"

vi.mock("server-only", () => ({}))

// The emails' words come from the app's words, English here.
const { registerEnglishWords } = await import("./translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)

test("verificationEmail carries the link, the hours and no tracking", async () => {
  const url =
    "http://localhost:3100/api/auth/verify-email?token=abc&callbackURL=%2F"
  const email = await verificationEmail(url, "en")

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

test("the team calendar email names the business as text", async () => {
  const email = await teamCalendarEmail({
    businessName: "Ana <b>& Co</b>",
    url: "https://book.example.com/team-calendar/abc",
    days: 7,
    language: "en",
  })
  expect(email.subject).toBe("Connect your Google Calendar to Ana <b>& Co</b>")
  expect(email.html).toContain("Ana &lt;b&gt;&amp; Co&lt;/b&gt;")
  expect(email.html).not.toContain("<b>")
  expect(email.text).toContain("https://book.example.com/team-calendar/abc")
  expect(email.text).toContain("The link works for 7 days, once.")
})

test("the password email carries the link and how long it works", async () => {
  const url =
    "https://book.example.com/api/auth/reset-password/abc?callbackURL=%2Freset-password"
  const email = await resetPasswordEmail(url, "en")
  expect(email.subject).toBe("Choose a new password")
  expect(email.text).toContain(url)
  expect(email.text).toContain(
    `The link works for ${ACCOUNT_RULES.passwordResetMinutes} minutes, once.`
  )
  expect(email.text).toContain(APP_NAME)
  expect(email.html).toContain(`<a href="${url}">`)
  expect(email.html).not.toContain("<img")
})

test("the team invite email takes the app's name from one place", async () => {
  const email = await teamInviteEmail({
    businessName: "Ana & Co",
    url: "https://book.example.com/invite/abc",
    days: 7,
    language: "en",
  })
  expect(email.subject).toBe(`Join Ana & Co on ${APP_NAME}`)
  expect(email.html).toContain("Ana &amp; Co")
})
