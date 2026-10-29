import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ExternalLinkIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { initials } from "@/lib/initials"
import type { AdminBusiness } from "../api/queries"
import type { AdminMessages } from "../i18n"

// Every business: its owner, its bookings and a link to its public page.
export function BusinessesList({
  businesses,
  m,
}: {
  businesses: AdminBusiness[]
  m: AdminMessages
}) {
  const t = m.businesses
  return (
    <ItemGroup className="gap-3">
      {businesses.map((business) => (
        <Item key={business.id} variant="outline">
          <ItemMedia>
            <Avatar>
              <AvatarFallback>{initials(business.name)}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>{business.name}</ItemTitle>
            <ItemDescription className="truncate">
              {`${business.ownerName ?? t.noOwner} · ${t.bookings(business.bookings)}`}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.open(business.name)}
              nativeButton={false}
              render={
                <a
                  href={`/b/${business.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLinkIcon />
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}
