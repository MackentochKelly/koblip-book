import { useLocale, useTranslations } from "next-intl"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StoreIcon } from "@/components/ui/icons"
import { useFormatDuration } from "@/hooks/use-format-duration"
import { formatPrice } from "@/lib/format-price"
import type { MyBooking } from "../types"

// The business's first photo, or a shop icon: the same in the Bookings list
// and on a booking's page.
export function BusinessAvatar({
  business,
}: {
  business: MyBooking["business"]
}) {
  return (
    <Avatar size="lg">
      {business.photoUrl && <AvatarImage src={business.photoUrl} alt="" />}
      <AvatarFallback>
        <StoreIcon className="size-5" />
      </AvatarFallback>
    </Avatar>
  )
}

// A booking's words, the same wherever it shows: the service with its
// extras, how long and with whom, the price, and what a reward took off it.
export function useBookingFacts(booking: MyBooking) {
  const t = useTranslations("public")
  const locale = useLocale()
  const formatDuration = useFormatDuration()
  const price =
    booking.priceMinor === null
      ? null
      : booking.priceMinor === 0
        ? t("booking.free")
        : formatPrice(booking.priceMinor, booking.currency, locale)
  const service = [
    booking.serviceName,
    ...booking.addons.map((addon) => `+ ${addon}`),
  ].join(" ")
  const details = [
    formatDuration(booking.durationMinutes),
    booking.teamMemberName &&
      t("booking.with", { name: booking.teamMemberName }),
  ]
    .filter(Boolean)
    .join(" · ")
  const reward = booking.rewardDiscountMinor
    ? t("booking.reward.off", {
        amount: formatPrice(
          -booking.rewardDiscountMinor,
          booking.currency,
          locale
        ),
      })
    : null
  return { price, reward, service, details }
}
