import { LinkIcon, MapPinIcon } from "@/components/ui/icons"
import { Item, ItemContent, ItemMedia } from "@/components/ui/item"

// Where the business is, on a soft chip with a pin.
export function BusinessAddress({ children }: { children: React.ReactNode }) {
  return (
    <Item
      variant="muted"
      size="xs"
      className="mt-1 w-fit max-w-full flex-nowrap gap-2 px-2.5 py-1.5 text-xs"
    >
      <ItemMedia>
        <MapPinIcon aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0 truncate">{children}</ItemContent>
    </Item>
  )
}

// The business's website on the same chip, for phones (computers have the
// Website button in the side card). Named "Website", not its address.
export function BusinessWebsite({
  url,
  label,
}: {
  url: string
  label: string
}) {
  return (
    <Item
      variant="muted"
      size="xs"
      className="w-fit max-w-full flex-nowrap gap-2 px-2.5 py-1.5 text-xs md:hidden"
      render={<a href={url} target="_blank" rel="noreferrer" />}
    >
      <ItemMedia>
        <LinkIcon aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0 truncate">{label}</ItemContent>
    </Item>
  )
}
