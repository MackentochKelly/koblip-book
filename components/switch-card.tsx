"use client"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"

// A card that opens something (an editor, a flow's steps) with its own
// switch on the side. The whole card is the open button: it stretches over
// the card with ::after, and the switch sits above it as its own control.
export function SwitchCard({
  title,
  description,
  openLabel,
  onOpen,
  on,
  onCheckedChange,
  switchLabel,
  switchDisabled,
  children,
}: {
  title: string
  description: string
  openLabel: string
  onOpen: () => void
  on: boolean
  onCheckedChange: (on: boolean) => void
  switchLabel: string
  switchDisabled?: boolean
  // A line under the text, e.g. the message's status.
  children?: React.ReactNode
}) {
  return (
    <Item variant="outline" className="relative has-[[data-slot=item-content]_button:hover]:bg-muted">
      <ItemContent className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="flex min-h-11 flex-col items-start justify-center gap-1 rounded-md text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </button>
        {children && <div className="mt-2">{children}</div>}
      </ItemContent>
      <ItemActions className="relative z-10">
        <Switch
          checked={on}
          disabled={switchDisabled}
          onCheckedChange={onCheckedChange}
          aria-label={switchLabel}
        />
      </ItemActions>
    </Item>
  )
}
