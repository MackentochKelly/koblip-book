import { expect, test } from "vitest"
import { ONBOARDING_RULES } from "./onboarding-rules"
import { verificationEmail } from "./email-templates"

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
