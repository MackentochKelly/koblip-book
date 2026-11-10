import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  BanknoteIcon,
  CalendarDaysIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
  TagIcon,
} from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { bookAgainHref, rescheduleHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import type { MyBooking } from "../types"
import { AddToCalendar } from "./add-to-calendar"
import { BusinessAvatar, useBookingFacts } from "./booking-facts"
import { BookingPayment } from "./booking-payment"
import { CantComeButton } from "./cant-come-button"

// Google Maps' search link for the business (Maps URLs, api=1): opens the
// Maps app on a phone, the site on a computer.
function mapsHref(business: MyBooking["business"]) {
  const query = [business.name, business.address].filter(Boolean).join(", ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// One of the client's bookings (docs/plans/client-account.md, D11): the
// business and where it is, the visit (with Add to calendar while it's
// ahead), then its one action: move or call
// it off while it's ahead, book again once it's over or cancelled.
// `review`: the client's review of the visit (from the reviews feature),
// under the visit.
export function BookingPage({
  booking,
  review,
}: {
  booking: MyBooking
  review?: React.ReactNode
}) {
  const t = useTranslations("public")
  const language = languageOf(useLocale())
  const { price, reward, service, details } = useBookingFacts(booking)
  const facts = [
    {
      key: "when",
      icon: CalendarDaysIcon,
      label: t("account.booking.when"),
      value: booking.when,
    },
    {
      key: "service",
      icon: TagIcon,
      label: t("account.booking.service"),
      value: service,
      more: details,
    },
    price && {
      key: "price",
      icon: BanknoteIcon,
      label: t("account.booking.price"),
      value: price,
      more: reward,
    },
    booking.note && {
      key: "note",
      icon: MessageCircleIcon,
      label: t("account.booking.note"),
      value: booking.note,
    },
  ].filter((fact) => !!fact)

  return (
    <div className="flex flex-col gap-8">
      <Item variant="box">
        <ItemMedia>
          <BusinessAvatar business={booking.business} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full truncate">
            {booking.business.name}
          </ItemTitle>
          {booking.business.address && (
            <ItemDescription className="line-clamp-2">
              {booking.business.address}
            </ItemDescription>
          )}
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={mapsHref(booking.business)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            {t("account.booking.map")}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </ItemActions>
      </Item>

      <PageSection
        id="visit"
        title={t("account.booking.title")}
        action={
          booking.cancelled ? (
            <Badge variant="destructive">{t("account.cancelled")}</Badge>
          ) : booking.ahead ? (
            <AddToCalendar booking={booking} />
          ) : undefined
        }
      >
        <ItemGroup className="gap-3">
          {facts.map((fact) => (
            <Item key={fact.key} variant="box">
              <ItemMedia variant="icon">
                <fact.icon />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemDescription>{fact.label}</ItemDescription>
                <ItemTitle className="w-full break-words">
                  {fact.value}
                </ItemTitle>
                {"more" in fact && fact.more && (
                  <ItemDescription>{fact.more}</ItemDescription>
                )}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </PageSection>

      <BookingPayment booking={booking} />

      {review}

      {booking.ahead && booking.cantCome ? (
        <ButtonGroup className="self-end">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={rescheduleHref(booking.id)} />}
          >
            {t("account.reschedule")}
          </Button>
          <CantComeButton booking={booking} />
        </ButtonGroup>
      ) : (
        !booking.ahead && (
          <Button
            className="self-end"
            nativeButton={false}
            render={
              <Link
                href={bookAgainHref(
                  booking.business.slug,
                  booking.serviceId,
                  language
                )}
              />
            }
          >
            {t("account.bookAgain")}
          </Button>
        )
      )}
    </div>
  )
}
