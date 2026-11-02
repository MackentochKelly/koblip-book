"use client"

import { Button } from "@/components/ui/button"
import { SearchIcon } from "@/components/ui/icons"
import { useFindBusiness } from "@/hooks/use-find-business"

// The home page's main button: scrolls up to the search box and puts the
// cursor in it. One look wherever it shows (pricing, the last call to
// action).
export function FindBusinessButton({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const findBusiness = useFindBusiness()
  return (
    <Button size="lg" onClick={findBusiness} className={className}>
      <SearchIcon
        data-icon="inline-start"
        // A little bigger and bolder, to match the button's words.
        className="size-5 stroke-[2.25]"
      />
      {children}
    </Button>
  )
}
