"use client"

import { heroEdgeClassName } from "@/components/glass-frame"
import { homeGroupSpaceClassName } from "@/components/home-band"
import { HeroGradient } from "@/components/hero-gradient"
import { useHomeLook } from "@/components/home-look"
import { FindBusinessButton } from "@/components/find-business-button"
import { cn } from "@/lib/utils"

// The home page's last call to action: a small copy of the hero panel
// (moving colours, glass edge) with one button that scrolls up to the
// search box and puts the cursor in it.
export function HomeCta({
  title,
  button,
  hint,
}: {
  title: string
  button: string
  hint: string
}) {
  // The "bands" look: a smaller card in the middle, with room round it, so
  // the page ends on an invitation, not a second hero.
  const bands = useHomeLook() === "bands"
  return (
    <section
      className={cn(
        "mx-auto w-full",
        bands
          ? "max-w-3xl px-2 py-16 sm:px-4 sm:py-24"
          : // A group's room above and below: the last call to action
            // stands alone.
            cn(
              "max-w-page px-2 pb-24 sm:px-4 sm:pb-36",
              homeGroupSpaceClassName
            )
      )}
    >
      <div
        className={cn(
          "relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-4xl px-6 py-16 text-center",
          heroEdgeClassName
        )}
      >
        <HeroGradient />
        <h2 className="font-display text-3xl font-medium tracking-tight text-balance text-hero-foreground sm:text-4xl">
          {title}
        </h2>
        <div className="flex flex-col items-center gap-3">
          <FindBusinessButton>{button}</FindBusinessButton>
          <p className="text-sm text-hero-foreground">{hint}</p>
        </div>
      </div>
    </section>
  )
}
