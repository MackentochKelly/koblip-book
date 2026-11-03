import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  fullScreenHostClassName,
  GlassCard,
  heroEdgeClassName,
} from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { StickyHeader } from "@/components/sticky-header"
import { SiteHeader } from "@/components/site-header"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { RememberOwnerLanguage } from "@/features/dashboard/i18n/remember-language"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { prepareFound } from "@/features/onboarding/api/prepare-found"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { readSignUpLink } from "@/features/onboarding/utils/sign-up-link"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { authWordsFor } from "@/features/owner-auth/i18n"
import { getSession } from "@/lib/dal"
import { languageParam } from "@/lib/page-language"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata({
  searchParams,
}: PageProps<"/login">): Promise<Metadata> {
  const { lang } = await searchParams
  const words = authWordsFor(await getOwnerLanguage(lang))
  return {
    title: readSignUpLink(await searchParams) ? words.signUp : words.logIn,
  }
}

// The home page's look: one rounded panel on the moving gradient, the
// login card in the same glass frame as the home box. With a business
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
  const words = authWordsFor(language)
  const googleError = typeof error === "string" ? error : null
  return (
    <LanguageProvider language={language}>
      {linked && <RememberOwnerLanguage language={linked} />}
      <div
        className={cn(
          "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
          fontDisplay.variable
        )}
      >
        {/* The header stays on top while the page scrolls. */}
        <StickyHeader>
          <SiteHeader floating />
        </StickyHeader>
        <section
          className={cn(
            "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
            heroEdgeClassName,
            fullScreenHostClassName
          )}
        >
          <HeroGradient />
          <main
            className={cn(
              "mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 pt-22 pb-24",
              // The home box's width, so it keeps its size coming in.
              found ? "max-w-xl" : "max-w-sm"
            )}
          >
            <h1 className="font-display text-3xl font-medium tracking-tight text-hero-foreground">
              {found ? words.signUp : words.logIn}
            </h1>
            {found ? (
              <GetStarted
                signedIn={signedIn}
                claim={claimBusiness}
                resume={finish === "__place__" ? null : finish}
                resumePending={finish === "__place__"}
                googleError={googleError}
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
            ) : (
              <GlassCard>
                <AuthForm
                  next={target}
                  googleError={googleError}
                  language={language}
                />
              </GlassCard>
            )}
          </main>
        </section>
      </div>
    </LanguageProvider>
  )
}
