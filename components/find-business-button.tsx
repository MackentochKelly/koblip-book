"use client"

import { Button } from "@/components/ui/button"
import { ArrowRightIcon, SearchIcon } from "@/components/ui/icons"
import { useFindBusiness } from "@/hooks/use-find-business"
import { cn } from "@/lib/utils"

// The home page's main button: scrolls up to the search box and puts the
// cursor in it. One look wherever it shows (pricing, the last call to
// action): a glass ring like the frame around the search box, and an arrow
// that steps forward on hover or keyboard focus.
export function FindBusinessButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const findBusiness = useFindBusiness()
  return (
    <Button
      size="lg"
      onClick={findBusiness}
      className={cn("ring-6 ring-glass-frame-edge", className)}
    >
      <SearchIcon
        data-icon="inline-start"
        // A little bigger and bolder, to match the button's words.
        className="size-5 stroke-[2.25]"
      />
      {children}
      <ArrowRightIcon
        data-icon="inline-end"
        className="size-5 stroke-[2.25] transition-transform duration-200 ease-(--ease-standard) group-hover/button:translate-x-1 group-focus-visible/button:translate-x-1 motion-reduce:transition-none"
      />
    </Button>
  )
}
