import Link from "next/link"

import { PageSection } from "@/components/page-section"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { StoreIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { rescheduleHref } from "@/lib/my-bookings-links"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import type { Messages } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import type { MyBooking } from "../types"
import { CantComeButton } from "./cant-come-button"

// One booking. What is ahead carries its "Can't make it"; what is over
// opens the business's page, to book again.
function BookingRow({
  booking,
  ahead,
  language,
  m,
}: {
  booking: MyBooking
  ahead: boolean
  language: PageLanguage
  m: Messages
}) {
  const price =
    booking.priceMinor === null
      ? null
      : booking.priceMinor === 0
        ? m.booking.free
        : formatPrice(booking.priceMinor, booking.currency, m.locale)
  const details = [
    formatDuration(booking.durationMinutes),
    booking.teamMemberName && m.booking.with(booking.teamMemberName),
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <Item
      variant="box"
      render={
        ahead ? undefined : (
          <Link href={`/b/${booking.business.slug}?lang=${language}`} />
        )
      }
    >
      <ItemMedia>
        <Avatar size="lg">
          {booking.business.photoUrl && (
            <AvatarImage src={booking.business.photoUrl} alt="" />
          )}
          <AvatarFallback>
            <StoreIcon className="size-5" />
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full truncate">
          {booking.business.name}
        </ItemTitle>
        <ItemDescription className="truncate">{booking.when}</ItemDescription>
        <ItemDescription className="truncate">
          {[
            booking.serviceName,
            ...booking.addons.map((addon) => `+ ${addon}`),
          ].join(" ")}
          {details && ` · ${details}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-col items-end gap-1">
        {booking.cancelled && (
          <Badge variant="destructive">{m.account.cancelled}</Badge>
        )}
        {price && <span className="text-sm tabular-nums">{price}</span>}
      </ItemActions>
      {ahead && booking.cantCome && (
        <ItemFooter className="justify-end">
          <ButtonGroup>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={rescheduleHref(booking.id, language)} />}
            >
              {m.account.reschedule}
            </Button>
            <CantComeButton booking={booking} />
          </ButtonGroup>
        </ItemFooter>
      )}
    </Item>
  )
}

// The customer's bookings at every business: what is ahead first, then the
// rest.
export function MyBookingsList({
  upcoming,
  past,
  language,
  m,
}: {
  upcoming: MyBooking[]
  past: MyBooking[]
  language: PageLanguage
  m: Messages
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{m.account.none}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex w-full flex-col gap-8">
      <PageSection id="upcoming" title={m.account.upcoming}>
        {upcoming.length ? (
          <ItemGroup className="gap-3">
            {upcoming.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                ahead
                language={language}
                m={m}
              />
            ))}
          </ItemGroup>
        ) : (
          <p className="text-sm text-muted-foreground">
            {m.account.noneUpcoming}
          </p>
        )}
      </PageSection>
      {past.length > 0 && (
        <PageSection id="past" title={m.account.past}>
          <ItemGroup className="gap-3">
            {past.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                ahead={false}
                language={language}
                m={m}
              />
            ))}
          </ItemGroup>
        </PageSection>
      )}
    </div>
  )
}
