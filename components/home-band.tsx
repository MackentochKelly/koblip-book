"use client"

import { useHomeLook } from "@/components/home-look"
import { DotPattern } from "@/components/ui/dot-pattern"
import { cn } from "@/lib/utils"

// A home section's band in the "bands" test look (/new): a rounded panel
// like the hero, the same gap apart, with the same room above and below
// every section. "plain" is the page colour; "muted" the soft grey with
// Magic UI's dot pattern fading out from the middle; "dark" the theme's
// dark colours (its `.dark` tokens), with a faint edge so it still stands
// apart on the dark theme. The sections inside drop their own padding.
// Other looks: the sections as they are.
export function HomeBand({
  tone,
  children,
}: {
  tone: "plain" | "muted" | "dark"
  children: React.ReactNode
}) {
  if (useHomeLook() !== "bands") return children
  return (
    <div
      className={cn(
        "relative isolate mt-2 flex flex-col gap-12 overflow-hidden rounded-4xl py-16 *:py-0 sm:mt-3 sm:py-24",
        tone === "muted" && "bg-muted",
        tone === "dark" &&
          "dark bg-background text-foreground ring-1 ring-foreground/10"
      )}
    >
      {tone === "muted" && (
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
