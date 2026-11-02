import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { GlassCard, heroEdgeClassName } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { StickyHeader } from "@/components/sticky-header"
import { SiteHeader } from "@/components/site-header"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { prepareFound } from "@/features/onboarding/api/prepare-found"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { readSignUpLink } from "@/features/onboarding/utils/sign-up-link"
import { AuthForm } from "@/features/owner-auth/components/auth-form"
import { authWordsFor } from "@/features/owner-auth/i18n"
import { getSession } from "@/lib/dal"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata({
  searchParams,
}: PageProps<"/login">): Promise<Metadata> {
  const words = authWordsFor(await getOwnerLanguage())
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
  if (session && !session.isGuest) {
    redirect(target)
  }
  const language = await getOwnerLanguage()
  const words = authWordsFor(language)
  const found = readSignUpLink(params)
  return (
    <LanguageProvider language={language}>
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
            heroEdgeClassName
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
                signedIn={false}
                claim={claimBusiness}
                hint={false}
                // Not awaited: the page shows at once, the card's photo
                // follows when the page is built.
                start={{
                  name: found.name,
                  address: found.address,
                  prepared: prepareFound(found),
                }}
                language={language}
              />
            ) : (
              <GlassCard>
                <AuthForm
                  next={target}
                  googleError={typeof error === "string" ? error : null}
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
