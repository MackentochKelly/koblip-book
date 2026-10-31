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
import { formatClock, formatWeekday } from "@/lib/format-booking-time"
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
            {business.team?.map((member) => <div key={member.id} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{member.name}</span>
              {member.hours.length === 0 ? <span className="text-muted-foreground">{t.sameHours}</span> : member.hours.map((row) =>
                <span key={row.id} className="text-muted-foreground">{formatWeekday(row.weekday, m.locale)} · {formatClock(row.opensAt, m.locale)}–{formatClock(row.closesAt, m.locale)}</span>
              )}
            </div>)}
            {business.customers && business.customers.length > 0 && <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t.addedCustomers}</span>
              {business.customers.map((customer) => <span key={customer.id} className="text-muted-foreground">{customer.phone ? `${customer.name} · ${customer.phone}` : customer.name}</span>)}
            </div>}
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
