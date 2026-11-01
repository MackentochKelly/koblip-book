"use client"

import { InfoTip } from "@/components/info-tip"

// The one short helper line a screen may have, with anything longer behind an
// ⓘ (docs/ui-rules/forms-and-text.md).
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
      {more && <InfoTip label={moreLabel}>{more}</InfoTip>}
    </div>
  )
}
