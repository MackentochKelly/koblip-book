"use client"

import { heroEdgeClassName } from "@/components/glass-frame"
import { HeroGradient } from "@/components/hero-gradient"
import { GET_STARTED_ID } from "@/components/home-section-title"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "@/components/ui/icons"
import { useReducedMotion } from "@/hooks/use-theme-colors"
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
  const still = useReducedMotion()
  function findBusiness() {
    const target = document.getElementById(GET_STARTED_ID)
    if (!target) return
    target.scrollIntoView({
      behavior: still ? "auto" : "smooth",
      block: "center",
    })
    target.querySelector("input")?.focus({ preventScroll: true })
  }
  return (
    <section className="mx-auto w-full max-w-5xl px-2 pb-12 sm:px-4">
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
          <Button size="lg" onClick={findBusiness}>
            <SearchIcon data-icon="inline-start" />
            {button}
          </Button>
          <p className="text-sm text-hero-foreground">{hint}</p>
        </div>
      </div>
    </section>
  )
}
