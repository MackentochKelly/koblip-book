import Link from "next/link"
import {
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
  PhoneIcon,
  StoreIcon,
} from "@/components/ui/icons"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

// The caller's words for the hours row, in the page's language.
export interface BusinessDetailsLabels {
  noHours: string
  openDays: (days: number) => string
}

export interface BusinessDetailsData {
  // Left out where the business's name and address already show above.
  name?: string
  address?: string | null
  category: string | null
  phone: string | null
  website: string | null
  // Days of the week with opening hours.
  openDays: number
}

// What came from Google Maps, one row each. Used on the login step and on
// the dashboard's "Check your details" card.
export function BusinessDetails({
  details,
  hoursHref,
  labels,
}: {
  details: BusinessDetailsData
  hoursHref?: string
  labels: BusinessDetailsLabels
}) {
  const store = details.name
    ? details.category
      ? `${details.name} · ${details.category}`
      : details.name
    : details.category
  const rows = [
    { icon: StoreIcon, value: store },
    { icon: PhoneIcon, value: details.phone },
    { icon: MapPinIcon, value: details.address },
    { icon: GlobeIcon, value: details.website },
  ].filter((row): row is { icon: typeof StoreIcon; value: string } =>
    Boolean(row.value)
  )

  return (
    <ItemGroup className="gap-1">
      {rows.map(({ icon: Icon, value }) => (
        <Item key={value} size="sm" className="px-0 py-1.5">
          <ItemMedia variant="icon">
            <Icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="font-normal wrap-break-word">
              {value}
            </ItemTitle>
          </ItemContent>
        </Item>
      ))}
      <Item
        size="sm"
        className="px-0 py-1.5"
        render={hoursHref ? <Link href={hoursHref} /> : undefined}
      >
        <ItemMedia variant="icon">
          <ClockIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="font-normal">
            {details.openDays === 0
              ? labels.noHours
              : labels.openDays(details.openDays)}
          </ItemTitle>
        </ItemContent>
        {hoursHref && (
          <ItemActions>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </ItemActions>
        )}
      </Item>
    </ItemGroup>
  )
}
