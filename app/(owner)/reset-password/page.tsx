import type { Metadata } from "next"

import { GlassCard } from "@/components/glass-frame"
import { LanguageProvider } from "@/components/language-provider"
import { RememberOwnerLanguage } from "@/features/dashboard/i18n/remember-language"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { AuthPageFrame } from "@/features/owner-auth/components/auth-page-frame"
import { ResetPasswordForm } from "@/features/owner-auth/components/reset-password-form"
import { authWordsFor } from "@/features/owner-auth/i18n"
import { languageParam } from "@/lib/page-language"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata({
  searchParams,
}: PageProps<"/reset-password">): Promise<Metadata> {
  const { lang } = await searchParams
  return { title: authWordsFor(await getOwnerLanguage(lang)).newPassword }
}

// Where the "Forgot password" email's link lands. An old or used link comes
// back here with `error` instead of `token`
// (better-auth.com/docs/authentication/email-password#request-password-reset).
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token, next, lang } = await searchParams
  // The link names the language it was asked for in, and it is remembered
  // for the owner area after it.
  const linked = languageParam(lang)
  const language = await getOwnerLanguage(lang)
  return (
    <LanguageProvider language={language}>
      {linked && <RememberOwnerLanguage language={linked} />}
      <AuthPageFrame title={authWordsFor(language).newPassword}>
        <GlassCard>
          <ResetPasswordForm
            token={typeof token === "string" ? token : null}
            next={safeNext(typeof next === "string" ? next : undefined)}
            language={language}
          />
        </GlassCard>
      </AuthPageFrame>
    </LanguageProvider>
  )
}
