import type { Metadata } from "next"
import Link from "next/link"

import { HeroGradient } from "@/components/hero-gradient"
import { MetaProviderBadge } from "@/components/meta-provider-badge"
import { headerButtonClassName, SiteHeader } from "@/components/site-header"
import { WorksWith } from "@/components/works-with"
import { Button } from "@/components/ui/button"
import { Highlighter } from "@/components/ui/highlighter"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { getSession } from "@/lib/dal"
import { fontDisplay, fontSerif } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Koblip Book",
  description: "Your booking page in one minute.",
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const signedIn = (await getSession()) !== null
  const { claim } = await searchParams
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background p-2 sm:p-3",
        fontDisplay.variable,
        fontSerif.variable
      )}
    >
      {/* The hero: one rounded panel with a moving gradient, everything
          centered on it. */}
      <section className="relative isolate flex flex-1 flex-col overflow-hidden rounded-4xl">
        <HeroGradient />
        <SiteHeader
          action={
            <Button
              variant="outline"
              className={headerButtonClassName}
              nativeButton={false}
              render={<Link href={signedIn ? "/dashboard" : "/login"} />}
            >
              {signedIn ? "Dashboard" : "Log in"}
            </Button>
          }
        />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 pt-12 pb-24 text-center">
          <div className="flex flex-col gap-4">
            <MetaProviderBadge />
            <h1 className="font-display text-hero font-medium tracking-tight text-balance text-hero-foreground sm:text-7xl">
              Your booking page in one{" "}
              <span className="font-serif font-normal tracking-normal italic">
                minute
              </span>
            </h1>
            {/* One sentence per line, quieter than the title. */}
            <p className="font-display text-lg/snug text-balance text-hero-foreground *:block sm:text-xl/snug">
              {/* Magic UI's marker, its words kept above the drawn mark. The
                  mark is see-through so the moving gradient shows in it. */}
              <span className="[&_.rough-annotation]:opacity-80">
                Find your business on{" "}
                <Highlighter color="var(--hero-marker)">
                  <span className="relative z-10 text-hero-marker-foreground">
                    Google Maps.
                  </span>
                </Highlighter>
              </span>{" "}
              <span>We turn it into your booking page.</span>
            </p>
          </div>
          <GetStarted
            signedIn={signedIn}
            claim={claimBusiness}
            resume={typeof claim === "string" ? claim : null}
          />
        </main>
      </section>
      <WorksWith />
    </div>
  )
}
