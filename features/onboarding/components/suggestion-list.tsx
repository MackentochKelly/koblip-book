import { Fragment, type ReactNode } from "react"

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { GoogleMapsCredit } from "@/components/google-maps-credit"
import { cn } from "@/lib/utils"

export interface Suggestion {
  id: string
  title: string
  description: string | null
}

// Light tappable result rows (grey on touch), a line between each: icon,
// title, one-line description. The busy row
// shows a spinner in place of the icon. The rows are Google Places results
// shown without a Google map, so Google's logo goes under them.
export function SuggestionList({
  items,
  busyId = null,
  onPick,
  icon,
  className,
  creditClassName = "self-end",
}: {
  items: Suggestion[]
  busyId?: string | null
  onPick: (id: string) => void
  icon: ReactNode
  className?: string
  creditClassName?: string
}) {
  return (
    <ItemGroup className={cn("gap-0", className)}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 && <ItemSeparator className="my-1" />}
          <Item
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
        </Fragment>
      ))}
      <GoogleMapsCredit className={creditClassName} />
    </ItemGroup>
  )
}
