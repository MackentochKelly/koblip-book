import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { HeroCardPage, HeroPage } from "@/components/hero-card-page"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { RememberOwnerLanguage } from "@/features/dashboard/i18n/remember-language"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { prepareFound } from "@/features/onboarding/api/prepare-found"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { readSignUpLink } from "@/features/onboarding/utils/sign-up-link"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { getSession } from "@/lib/dal"
import { languageParam } from "@/lib/page-language"
import { phoneSignInReady } from "@/lib/phone-sign-in"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata({
  searchParams,
}: PageProps<"/login">): Promise<Metadata> {
  const t = await getTranslations("ownerAuth")
  return {
    title: readSignUpLink(await searchParams) ? t("signUp") : t("logIn"),
  }
}

// The login card in the same glass frame as the home box. With a business
// picked on the home page, it is the sign-up page: that business's card
// over the sign-up form, its page built meanwhile.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const { next, error } = params
  const target = safeNext(typeof next === "string" ? next : undefined)
  // A demo guest has no account yet: they see the form like anyone else.
  const session = await getSession()
  const signedIn = session !== null && !session.isGuest
  const link = readSignUpLink(params)
  const found = link?.found
  // Back from Google on the sign-up page: it stays, to finish there.
  const finish = signedIn ? (link?.finish ?? null) : null
  if (signedIn && !finish) {
    redirect(target)
  }
  // A link from the home page names its language: the page keeps it, and
  // it is remembered for the owner area after it.
  const linked = languageParam(params.lang)
  const language = await getOwnerLanguage(params.lang)
  const t = await getTranslations("ownerAuth")
  const googleError = typeof error === "string" ? error : null
  const remember = linked && <RememberOwnerLanguage language={linked} />
  if (!found) {
    return (
      <HeroCardPage language={language} title={t("logIn")}>
        {remember}
        <AuthForm
          next={target}
          googleError={googleError}
          phoneSignIn={phoneSignInReady()}
          language={language}
        />
      </HeroCardPage>
    )
  }
  return (
    <HeroPage language={language} title={t("signUp")} wide>
      {remember}
      <GetStarted
        signedIn={signedIn}
        claim={claimBusiness}
        resume={finish === "__place__" ? null : finish}
        resumePending={finish === "__place__"}
        googleError={googleError}
        phoneSignIn={phoneSignInReady()}
        hint={false}
        // Not awaited: the page shows at once, the card's photo
        // follows when the page is built.
        start={{
          found,
          name: found.name,
          address: found.address,
          photoUrl:
            "placeId" in found
              ? `/api/business-preview-photo?place=${encodeURIComponent(found.placeId)}`
              : `/api/business-preview-photo?business=${encodeURIComponent(found.slug)}`,
          prepared: prepareFound(found),
        }}
        language={language}
      />
    </HeroPage>
  )
}
