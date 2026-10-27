import { GlobeIcon, MapPinIcon } from "lucide-react"
import { Item, ItemContent, ItemMedia } from "@/components/ui/item"

// Where the business is, on a soft chip with a pin.
export function BusinessAddress({ children }: { children: React.ReactNode }) {
  return (
    <Item
      variant="muted"
      size="xs"
      className="mt-1 w-fit max-w-full flex-nowrap"
    >
      <ItemMedia>
        <MapPinIcon aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0 truncate">{children}</ItemContent>
    </Item>
  )
}

// The business's website on the same chip, for phones (computers have the
// Website button in the side card).
export function BusinessWebsite({ url }: { url: string }) {
  let host = url
  try {
    host = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    // Not a full address: show it as saved.
  }
  return (
    <Item
      variant="muted"
      size="xs"
      className="w-fit max-w-full flex-nowrap md:hidden"
      render={<a href={url} target="_blank" rel="noreferrer" />}
    >
      <ItemMedia>
        <GlobeIcon aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0 truncate">{host}</ItemContent>
    </Item>
  )
}
