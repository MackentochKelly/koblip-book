"use client"

import { Button } from "@/components/ui/button"
import { InfoCircleIcon } from "@/components/ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// An ⓘ with more words behind it (docs/ui-rules/forms-and-text.md). A
// popover that also opens on hover, not a tooltip: Base UI's tooltips never
// open on touch, and its docs point infotips to a popover with `openOnHover`.
export function InfoTip({
  children,
  label,
}: {
  children: React.ReactNode
  // The ⓘ button's name for screen readers.
  label?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={<Button variant="ghost" size="icon-sm" aria-label={label} />}
      >
        <InfoCircleIcon />
      </PopoverTrigger>
      <PopoverContent className="text-pretty">{children}</PopoverContent>
    </Popover>
  )
}
