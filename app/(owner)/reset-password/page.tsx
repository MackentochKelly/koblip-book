import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { HeroCardPage } from "@/components/hero-card-page"
import { RememberOwnerLanguage } from "@/features/dashboard/i18n/remember-language"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { ResetPasswordForm } from "@/features/owner-auth/components/reset-password-form"
import { languageParam } from "@/lib/page-language"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ownerAuth")
  return { title: t("newPassword") }
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
  const t = await getTranslations("ownerAuth")
  return (
    <HeroCardPage language={language} title={t("newPassword")}>
      {linked && <RememberOwnerLanguage language={linked} />}
      <ResetPasswordForm
        token={typeof token === "string" ? token : null}
        next={safeNext(typeof next === "string" ? next : undefined)}
        language={language}
      />
    </HeroCardPage>
  )
}
