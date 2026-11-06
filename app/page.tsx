import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import {
  fullScreenHostClassName,
  heroEdgeClassName,
} from "@/components/glass-frame"
import { StickyHeader } from "@/components/sticky-header"
import { HeroGradient } from "@/components/hero-gradient"
import { HomeBand } from "@/components/home-band"
import { HeroSideCards } from "@/components/hero-side-cards"
import { HomeCta } from "@/components/home-cta"
import { HomeEverything } from "@/components/home-everything"
import { HomeFaq } from "@/components/home-faq"
import { HomeFeatures } from "@/components/home-features"
import { HomePricing } from "@/components/home-pricing"
import { GET_STARTED_ID } from "@/components/home-section-title"
import { HowItWorks } from "@/components/how-it-works"
import { MadeFor } from "@/components/made-for"
import { SeeItInAction } from "@/components/see-it-in-action"
import { LanguageMenu } from "@/components/language-menu"
import { LanguageProvider } from "@/components/language-provider"
import { HackathonBadge } from "@/components/hackathon-badge"
import { SiteFooter } from "@/components/site-footer"
import { SupportBox } from "@/components/support-box"
import { headerButtonClassName, SiteHeader } from "@/components/site-header"
import { WordsProvider } from "@/components/words-provider"
import { WorksWith } from "@/components/works-with"
import { Button } from "@/components/ui/button"
import { Highlighter } from "@/components/ui/highlighter"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { AFTER_LOGIN_PATH, loginHref } from "@/lib/auth-links"
import { getSession } from "@/lib/dal"
import { fontDisplay, fontSerif } from "@/lib/fonts"
import { languageOf } from "@/lib/page-language"
import { cn } from "@/lib/utils"

// The page's language (proxy.ts): ?lang= wins, then the visitor's browser
// language, else English, as on a business page.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.home")
  return { title: "Koblip Book", description: t("description") }
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // A demo guest is not signed in for this page: they still see Log in.
  const session = await getSession()
  const signedIn = session !== null && !session.isGuest
  const { claim } = await searchParams
  const language = languageOf(await getLocale())
  const t = await getTranslations("public.home")
  const onboarding = await getTranslations("onboarding")
  return (
    // GetStarted shows the onboarding and owner sign-in words too.
    <WordsProvider namespaces={["app", "public", "onboarding", "ownerAuth"]}>
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
                  render={
                    <Link
                      href={signedIn ? AFTER_LOGIN_PATH : loginHref({ language })}
                    />
                  }
                >
                  {signedIn ? t("dashboard") : t("logIn")}
                </Button>
              }
            />
          </StickyHeader>
          {/* The hero: one rounded panel with a moving gradient, everything
            centered on it. */}
          <section
            className={cn(
              "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
              heroEdgeClassName,
              fullScreenHostClassName
            )}
          >
            <HeroGradient />
            <HeroSideCards />
            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 pt-28 pb-12 text-center sm:pb-24">
              {/* A little more room round the title than between its lines. */}
              <div className="flex flex-col gap-6">
                <HackathonBadge />
                <div className="flex flex-col gap-4">
                  <h1 className="font-display text-hero font-medium tracking-tight text-balance text-hero-foreground sm:text-6xl md:text-7xl">
                    {t("titleStart")}{" "}
                    <span className="font-serif font-normal tracking-normal italic">
                      {t("titleEnd")}
                    </span>
                  </h1>
                  {/* One sentence per line, quieter than the title. */}
                  <p className="font-sans text-base/snug text-balance text-hero-foreground *:block sm:text-xl/snug">
                    {/* Magic UI's marker, its words kept above the drawn mark. The
                    mark is see-through so the moving gradient shows in it. */}
                    <span className="[&_.rough-annotation]:opacity-80">
                      {t("findOn")}{" "}
                      <Highlighter color="var(--hero-marker)">
                        <span className="relative z-10 text-hero-marker-foreground">
                          {t("maps")}
                        </span>
                      </Highlighter>
                    </span>{" "}
                    <span>{t("weTurn")}</span>
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
                  handOver
                  language={language}
                />
              </div>
            </main>
          </section>
          <SupportBox />
          <HomeBand tone="plain" space="row">
            <WorksWith />
            <MadeFor />
          </HomeBand>
          <HomeBand tone="muted" space="group" dots>
            <HowItWorks />
          </HomeBand>
          <HomeBand tone="plain" space="row">
            <HomeFeatures />
          </HomeBand>
          <HomeBand tone="plain" space="group">
            <HomeEverything />
          </HomeBand>
          <HomeBand tone="brand" space="group">
            <SeeItInAction />
          </HomeBand>
          <HomeBand tone="plain" space="group">
            <HomePricing />
          </HomeBand>
          <HomeBand tone="muted" space="group">
            <HomeFaq />
          </HomeBand>
          <HomeCta
            title={t("cta.title")}
            button={t("cta.button")}
            hint={onboarding("hint")}
          />
          <SiteFooter />
        </div>
      </LanguageProvider>
    </WordsProvider>
  )
}
