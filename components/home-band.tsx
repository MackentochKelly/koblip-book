"use client"

import { useHomeLook } from "@/components/home-look"
import { DotPattern } from "@/components/ui/dot-pattern"
import { GridPattern } from "@/components/ui/grid-pattern"
import { cn } from "@/lib/utils"

// A home section's band in the "bands" test look (/new): a rounded panel
// like the hero, the same gap apart, with the same room above and below
// every section. "plain" is the page colour; "muted" the soft grey, with
// Magic UI's dot pattern fading out from the middle when `dots`; "brand"
// the theme's deepest indigo (bg-brand-deep) with Magic UI's grid pattern,
// and the theme's dark tokens (`.dark`) for the words on it. The sections
// inside drop their own padding.
// Other looks: the sections as they are.
export function HomeBand({
  tone,
  dots = false,
  children,
}: {
  tone: "plain" | "muted" | "brand"
  dots?: boolean
  children: React.ReactNode
}) {
  if (useHomeLook() !== "bands") return children
  return (
    <div
      className={cn(
        "relative isolate mt-2 flex flex-col gap-12 overflow-hidden rounded-4xl py-16 *:py-0 sm:mt-3 sm:py-24",
        tone === "muted" && "bg-muted",
        tone === "brand" && "dark bg-brand-deep text-foreground"
      )}
    >
      {tone === "brand" && (
        <GridPattern
          width={48}
          height={48}
          className="-z-10 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_70%)] stroke-foreground/10"
        />
      )}
      {tone === "muted" && dots && (
        <DotPattern
          width={20}
          height={20}
          className="-z-10 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)] text-foreground/15"
        />
      )}
      {children}
    </div>
  )
}
