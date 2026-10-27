import type { ReactNode } from "react"

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { GoogleMapsCredit } from "@/components/google-maps-credit"

export interface Suggestion {
  id: string
  title: string
  description: string | null
}

// Light tappable result rows (grey on touch): icon, title, one-line
// description. The busy row
// shows a spinner in place of the icon. The rows are Google Places results
// shown without a Google map, so Google's logo goes under them.
export function SuggestionList({
  items,
  busyId = null,
  onPick,
  icon,
}: {
  items: Suggestion[]
  busyId?: string | null
  onPick: (id: string) => void
  icon: ReactNode
}) {
  return (
    <ItemGroup className="gap-1">
      {items.map((item) => (
        <Item
          key={item.id}
          size="sm"
          render={<button type="button" onClick={() => onPick(item.id)} />}
          className="text-left hover:bg-muted"
        >
          <ItemMedia variant="icon">
            {busyId === item.id ? <Spinner /> : icon}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{item.title}</ItemTitle>
            {item.description && (
              <ItemDescription className="line-clamp-1">
                {item.description}
              </ItemDescription>
            )}
          </ItemContent>
        </Item>
      ))}
      <GoogleMapsCredit className="self-end" />
    </ItemGroup>
  )
}
