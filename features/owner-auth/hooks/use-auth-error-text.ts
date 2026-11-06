import { useTranslations } from "next-intl"

import { ONBOARDING_RULES } from "@/lib/onboarding-rules"
import type { AuthError } from "../utils/auth-error"

// What went wrong, in words: the password ones name the lengths
// ONBOARDING_RULES allows ({min}, {max}).
export function useAuthErrorText() {
  const t = useTranslations("ownerAuth.errors")
  return (message: AuthError["message"]) =>
    t(message, {
      min: ONBOARDING_RULES.minPasswordLength,
      max: ONBOARDING_RULES.maxPasswordLength,
    })
}
