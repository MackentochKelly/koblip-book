import type { ReactNode } from "react"

import {
  fullScreenHostClassName,
  heroEdgeClassName,
} from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { SiteHeader } from "@/components/site-header"
import { StickyHeader } from "@/components/sticky-header"
import { fontDisplay } from "@/lib/fonts"
import { cn } from "@/lib/utils"

// The home page's look for the account screens: one rounded panel on the
// moving gradient, a title over the card. `wide` is the home box's width.
export function AuthPageFrame({
  title,
  wide = false,
  children,
}: {
  title: string
  wide?: boolean
  children: ReactNode
}) {
  return (
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
            wide ? "max-w-xl" : "max-w-sm"
          )}
        >
          <h1 className="font-display text-3xl font-medium tracking-tight text-hero-foreground">
            {title}
          </h1>
          {children}
        </main>
      </section>
    </div>
  )
}
