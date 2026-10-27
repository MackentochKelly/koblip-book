import type { Metadata } from "next"
import { Instrument_Serif, Inter_Tight } from "next/font/google"
import Link from "next/link"
import { BadgeCheckIcon } from "lucide-react"

import { HeroGradient } from "@/components/hero-gradient"
import { SiteHeader } from "@/components/site-header"
import { WorksWith } from "@/components/works-with"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { getSession } from "@/lib/dal"
import { cn } from "@/lib/utils"

// The home title's own type: a tight sans with one serif italic word.
const fontDisplay = Inter_Tight({ subsets: ["latin"], variable: "--font-display" })
const fontSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
})

export const metadata: Metadata = {
  title: "Koblip Book",
  description: "Your booking page in one minute.",
}

export default async function HomePage() {
  const signedIn = (await getSession()) !== null
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
              nativeButton={false}
              render={<Link href={signedIn ? "/dashboard" : "/login"} />}
            >
              {signedIn ? "Dashboard" : "Log in"}
            </Button>
          }
        />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 pt-12 pb-24 text-center">
          <div className="flex flex-col gap-4">
            {/* Plain words only: Meta's logo needs Meta's approval
                (meta.com/brand/resources/meta/company-brand). Glass like the
                switch below. */}
            <Badge
              variant="outline"
              className="h-auto self-center border-background/30 bg-background/35 px-3 py-1 text-sm backdrop-blur-md dark:bg-background/60"
            >
              <BadgeCheckIcon data-icon="inline-start" />
              Verified Meta Tech Provider
            </Badge>
            <h1 className="font-display text-hero font-medium tracking-tight text-balance text-hero-foreground sm:text-7xl">
              Your booking page in one{" "}
              <span className="font-serif font-normal tracking-normal italic">
                minute
              </span>
            </h1>
            <p className="font-display text-lg text-secondary-foreground sm:text-xl">
              Find your business. We build the rest.
            </p>
          </div>
          <GetStarted signedIn={signedIn} claim={claimBusiness} />
        </main>
      </section>
      <WorksWith />
    </div>
  )
}
