import Link from "next/link"
import { useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  ACCOUNT_ADD_PHONE_PATH,
  accountBookingHref,
} from "@/lib/my-bookings-links"
import type { MyBooking } from "../types"
import { BusinessAvatar, useBookingFacts } from "./booking-facts"

// One booking, opening its own page (D11), where it can be moved, called
// off or booked again.
function BookingRow({ booking }: { booking: MyBooking }) {
  const t = useTranslations("public.account")
  const { price, service, details } = useBookingFacts(booking)
  return (
    <Item variant="box" render={<Link href={accountBookingHref(booking.id)} />}>
      <ItemMedia>
        <BusinessAvatar business={booking.business} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full truncate">
          {booking.business.name}
        </ItemTitle>
        <ItemDescription className="truncate">{booking.when}</ItemDescription>
        <ItemDescription className="truncate">
          {service}
          {details && ` · ${details}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-col items-end gap-1">
        {booking.cancelled && (
          <Badge variant="destructive">{t("cancelled")}</Badge>
        )}
        {price && <span className="text-sm tabular-nums">{price}</span>}
      </ItemActions>
    </Item>
  )
}

// The customer's bookings at every business: what is ahead first, then the
// rest.
// With none at all, its one action: add the phone the client books with,
// so those bookings show (`addPhone`, when the account has none and codes
// can be sent).
export function MyBookingsList({
  upcoming,
  past,
  addPhone,
}: {
  upcoming: MyBooking[]
  past: MyBooking[]
  addPhone: boolean
}) {
  const t = useTranslations("public.account")
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("none")}</EmptyTitle>
        </EmptyHeader>
        {addPhone && (
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link href={ACCOUNT_ADD_PHONE_PATH} />}
            >
              {t("profile.addPhone")}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }
  return (
    <div className="flex w-full flex-col gap-8">
      <PageSection id="upcoming" title={t("upcoming")}>
        {upcoming.length ? (
          <ItemGroup className="gap-3">
            {upcoming.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ItemGroup>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noneUpcoming")}</p>
        )}
      </PageSection>
      {past.length > 0 && (
        <PageSection id="past" title={t("past")}>
          <ItemGroup className="gap-3">
            {past.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ItemGroup>
        </PageSection>
      )}
    </div>
  )
}
