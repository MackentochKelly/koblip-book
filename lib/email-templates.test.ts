import { expect, test } from "vitest"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { teamCalendarEmail, verificationEmail } from "./email-templates"

test("verificationEmail carries the link, the hours and no tracking", () => {
  const url =
    "http://localhost:3100/api/auth/verify-email?token=abc&callbackURL=%2F"
  const email = verificationEmail(url)

  expect(email.subject).toBe("Confirm your email")
  expect(email.text).toContain(url)
  expect(email.text).toContain(
    `The link works for ${ONBOARDING_RULES.emailVerificationHours} hours.`
  )
  expect(email.text).toContain("24")
  expect(email.html).toContain(`<a href="${url}">${url}</a>`)
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
