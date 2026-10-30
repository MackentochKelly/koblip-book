import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { heroEdgeClassName } from "@/components/glass-frame"
import { StickyHeader } from "@/components/sticky-header"
import { HeroGradient } from "@/components/hero-gradient"
import { HomeBand } from "@/components/home-band"
import { HeroSideCards } from "@/components/hero-side-cards"
import { HomeCta } from "@/components/home-cta"
import { HomeFaq } from "@/components/home-faq"
import { HomeFeatures } from "@/components/home-features"
import { GET_STARTED_ID } from "@/components/home-section-title"
import { HowItWorks } from "@/components/how-it-works"
import { MadeFor } from "@/components/made-for"
import { SeeItInAction } from "@/components/see-it-in-action"
import { LanguageMenu } from "@/components/language-menu"
import { LanguageProvider } from "@/components/language-provider"
import { MetaProviderBadge } from "@/components/meta-provider-badge"
import { SiteFooter } from "@/components/site-footer"
import { headerButtonClassName, SiteHeader } from "@/components/site-header"
import { WorksWith } from "@/components/works-with"
import { Button } from "@/components/ui/button"
import { Highlighter } from "@/components/ui/highlighter"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { onboardingWordsFor } from "@/features/onboarding/i18n"
import { getSession } from "@/lib/dal"
import { fontDisplay, fontSerif } from "@/lib/fonts"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"
import { cn } from "@/lib/utils"

// ?lang= wins, then the visitor's browser language, else English (as on a
// business page).
async function pageLanguage(searchParams: PageProps<"/">["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/">): Promise<Metadata> {
  const t = messagesFor(await pageLanguage(searchParams)).home
  return { title: "Koblip Book", description: t.description }
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // A demo guest is not signed in for this page: they still see Log in.
  const session = await getSession()
  const signedIn = session !== null && !session.isGuest
  const { claim } = await searchParams
  const language = await pageLanguage(searchParams)
  const t = messagesFor(language).home
  return (
    <LanguageProvider language={language}>
      <div
        className={cn(
          // overflow-x-clip: rows that slide sideways (ShowcaseRow) run to
          // the screen's edge and stop there.
          "flex min-h-dvh flex-col overflow-x-clip bg-background p-2 sm:p-3",
          fontDisplay.variable,
          fontSerif.variable
        )}
      >
        {/* The header stays on top while the page scrolls. */}
        <StickyHeader>
          <SiteHeader
            floating
            control={<LanguageMenu className={headerButtonClassName} />}
            action={
              <Button
                variant="outline"
                className={headerButtonClassName}
                nativeButton={false}
                render={<Link href={signedIn ? "/dashboard" : "/login"} />}
              >
                {signedIn ? t.dashboard : t.logIn}
              </Button>
            }
          />
        </StickyHeader>
        {/* The hero: one rounded panel with a moving gradient, everything
          centered on it. */}
        <section
          className={cn(
            "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
            heroEdgeClassName
          )}
        >
          <HeroGradient />
          <HeroSideCards words={t.steps.sample} shared={t.features.sample} />
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 pt-28 pb-12 text-center sm:pb-24">
            {/* A little more room round the title than between its lines. */}
            <div className="flex flex-col gap-6">
              <MetaProviderBadge language={language} />
              <div className="flex flex-col gap-4">
                <h1 className="font-display text-hero font-medium tracking-tight text-balance text-hero-foreground sm:text-7xl">
                  {t.titleStart}{" "}
                  <span className="font-serif font-normal tracking-normal italic">
                    {t.titleEnd}
                  </span>
                </h1>
                {/* One sentence per line, quieter than the title. */}
                <p className="font-display text-lg/snug text-balance text-hero-foreground *:block sm:text-xl/snug">
                  {/* Magic UI's marker, its words kept above the drawn mark. The
                  mark is see-through so the moving gradient shows in it. */}
                  <span className="[&_.rough-annotation]:opacity-80">
                    {t.findOn}{" "}
                    <Highlighter color="var(--hero-marker)">
                      <span className="relative z-10 text-hero-marker-foreground">
                        {t.maps}
                      </span>
                    </Highlighter>
                  </span>{" "}
                  <span>{t.weTurn}</span>
                </p>
              </div>
            </div>
            {/* The last call to action brings people back here. */}
            <div
              id={GET_STARTED_ID}
              className="flex w-full flex-col items-center"
            >
              <GetStarted
                signedIn={signedIn}
                claim={claimBusiness}
                resume={typeof claim === "string" ? claim : null}
                language={language}
              />
            </div>
          </main>
        </section>
        <HomeBand tone="plain">
          <WorksWith language={language} />
          <MadeFor language={language} />
        </HomeBand>
        <HomeBand tone="muted" dots>
          <HowItWorks words={t} />
        </HomeBand>
        <HomeBand tone="plain">
          <HomeFeatures words={t.features} />
        </HomeBand>
        <HomeBand tone="brand">
          <SeeItInAction words={t.action} language={language} />
        </HomeBand>
        <HomeBand tone="muted">
          <HomeFaq words={t.faq} />
        </HomeBand>
        <HomeCta
          title={t.cta.title}
          button={t.cta.button}
          hint={onboardingWordsFor(language).hint}
        />
        <SiteFooter language={language} />
      </div>
    </LanguageProvider>
  )
}
