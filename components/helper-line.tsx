"use client"

import { Button } from "@/components/ui/button"
import { InfoCircleIcon } from "@/components/ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// The one short helper line a screen may have, with anything longer behind an
// ⓘ (docs/ui-rules/forms-and-text.md). The ⓘ is a popover that also opens on
// hover, not a tooltip: Base UI's tooltips never open on touch, and its docs
// point infotips to a popover with `openOnHover`.
export function HelperLine({
  children,
  more,
  moreLabel,
}: {
  children: React.ReactNode
  more?: React.ReactNode
  // The ⓘ button's name for screen readers.
  moreLabel?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <p className="text-sm text-pretty text-muted-foreground">{children}</p>
      {more && (
        <Popover>
          <PopoverTrigger
            openOnHover
            render={<Button variant="ghost" size="icon-sm" aria-label={moreLabel} />}
          >
            <InfoCircleIcon />
          </PopoverTrigger>
          <PopoverContent className="text-pretty">{more}</PopoverContent>
        </Popover>
      )}
    </div>
  )
}
