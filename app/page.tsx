import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { heroEdgeClassName } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { LanguageProvider } from "@/components/language-provider"
import { MetaProviderBadge } from "@/components/meta-provider-badge"
import { headerButtonClassName, SiteHeader } from "@/components/site-header"
import { WorksWith } from "@/components/works-with"
import { Button } from "@/components/ui/button"
import { Highlighter } from "@/components/ui/highlighter"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { GetStarted } from "@/features/onboarding/components/get-started"
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
  const signedIn = (await getSession()) !== null
  const { claim } = await searchParams
  const language = await pageLanguage(searchParams)
  const t = messagesFor(language).home
  return (
    <LanguageProvider language={language}>
      <div
        className={cn(
          "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
          fontDisplay.variable,
          fontSerif.variable
        )}
      >
        {/* The hero: one rounded panel with a moving gradient, everything
          centered on it. */}
        <section
          className={cn(
            "relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl",
            heroEdgeClassName
          )}
        >
          <HeroGradient />
          <SiteHeader
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
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 pt-12 pb-24 text-center">
            <div className="flex flex-col gap-4">
              <MetaProviderBadge language={language} />
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
            <GetStarted
              signedIn={signedIn}
              claim={claimBusiness}
              resume={typeof claim === "string" ? claim : null}
              language={language}
            />
          </main>
        </section>
        <WorksWith language={language} />
      </div>
    </LanguageProvider>
  )
}
