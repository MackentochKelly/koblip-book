import { useLocale, useTranslations } from "next-intl"

import { PaymentProof } from "@/components/payment-proof"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useFormatDuration } from "@/hooks/use-format-duration"
import { useRewardWords } from "@/hooks/use-reward-words"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import {
  CARD_TYPE,
  leftToPay,
  paidInFullOnline,
  paymentBadgeState,
  proofDeleteDate,
} from "@/lib/payment-rules"
import type { BookingReward } from "@/lib/rewards"
import type { OwnerBooking } from "../types"
import { BookingStatusBadge } from "./booking-status-badge"
import { ContactButtons } from "./contact-buttons"
import { PaymentStatusBadge } from "./payment-status-badge"

function price(
  priceMinor: number | null,
  currency: string,
  locale: string,
  free: string
): string | null {
  if (priceMinor === null) return null
  return priceMinor === 0 ? free : formatPrice(priceMinor, currency, locale)
}

// What a booking's card payment still holds, in hundredths: what the
// owner can give back.
export function refundable(booking: OwnerBooking): number {
  const online = booking.payment?.online
  return online ? online.paidMinor - online.refundedMinor : 0
}

// One booking: when (and why, once cancelled), what with its extras, the
// total, how the customer chose to pay outside the app (and whether they
// did, which only the owner says: `onPaid`), the owner's note and quick
// ways to reach the customer. A reward shows as what it took off; `offer`
// is the customer's reward the owner can still redeem here (RW8).
export function BookingDetails({
  booking,
  onPaid,
  onRefund,
  offer,
  onRedeem,
  pending = false,
}: {
  booking: OwnerBooking
  offer?: BookingReward | null
  onRedeem?: (offer: BookingReward) => void
  // Marks the booking paid, or not paid after all. Left out: read only.
  onPaid?: (paid: boolean) => void
  // Asks to give back what the card paid. Left out: no Refund button.
  onRefund?: () => void
  pending?: boolean
}) {
  const t = useTranslations("owner.bookings")
  const locale = useLocale()
  const formatDuration = useFormatDuration()
  const free = t("details.free")
  const total = price(booking.priceMinor, booking.currency, locale, free)
  const rewards = useTranslations("owner.rewards")
  const words = useRewardWords(booking.currency)
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {formatDay(booking.date, locale)} ·{" "}
          {formatClock(booking.time, locale)} –{" "}
          {formatClock(booking.endTime, locale)}
        </p>
        <BookingStatusBadge status={booking.status} />
      </div>
      {booking.status === "cancelled" && booking.cancelReason && (
        <p className="text-muted-foreground">
          {t("details.reason", {
            reason: t(`cancel.reasons.${booking.cancelReason}`),
          })}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <p>{booking.serviceName}</p>
        {booking.addons.map((addon, index) => (
          <div
            key={index}
            className="flex justify-between gap-3 text-muted-foreground"
          >
            <span className="min-w-0">+ {addon.name}</span>
            {addon.priceMinor !== null && (
              <span>
                {price(addon.priceMinor, booking.currency, locale, free)}
              </span>
            )}
          </div>
        ))}
        {!!booking.rewardDiscountMinor && (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span className="min-w-0">{rewards("off")}</span>
            <span>
              {formatPrice(
                -booking.rewardDiscountMinor,
                booking.currency,
                locale
              )}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 text-muted-foreground">
          <span className="min-w-0">
            {formatDuration(booking.durationMinutes)}
            {booking.teamMemberName &&
              ` · ${t("details.with", { name: booking.teamMemberName })}`}
          </span>
          {total && (
            <span className="font-medium text-foreground">{total}</span>
          )}
        </div>
        {offer && onRedeem && (
          <Button
            variant="outline"
            className="self-start"
            disabled={pending}
            onClick={() => onRedeem(offer)}
          >
            {rewards("redeem", { reward: words.reward(offer.reward) })}
          </Button>
        )}
      </div>
      {booking.payment && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {booking.payment.method?.type === CARD_TYPE
                  ? t("payment.card")
                  : (booking.payment.method?.name ?? t("payment.later"))}
              </p>
              <PaymentStatusBadge status={paymentBadgeState(booking.payment)} />
            </div>
            {booking.payment.online && (
              <div className="flex flex-col text-muted-foreground">
                <p>
                  {t("payment.paidOnline", {
                    amount: formatPrice(
                      booking.payment.online.paidMinor,
                      booking.currency,
                      locale
                    ),
                  })}
                </p>
                {booking.payment.online.refundedMinor > 0 && (
                  <p>
                    {t("payment.refundedAmount", {
                      amount: formatPrice(
                        booking.payment.online.refundedMinor,
                        booking.currency,
                        locale
                      ),
                    })}
                  </p>
                )}
                {booking.payment.status !== "paid" &&
                  booking.status !== "cancelled" &&
                  (leftToPay(booking.priceMinor, booking.payment.online) ?? 0) >
                    0 && (
                    <p>
                      {t("payment.left", {
                        amount: formatPrice(
                          leftToPay(booking.priceMinor, booking.payment.online),
                          booking.currency,
                          locale
                        ),
                      })}
                    </p>
                  )}
              </div>
            )}
            {onRefund && refundable(booking) > 0 && (
              <Button
                variant="outline"
                className="self-start"
                disabled={pending}
                onClick={onRefund}
              >
                {t("payment.refund.open")}
              </Button>
            )}
            {booking.payment.reference && (
              <p className="break-words text-muted-foreground">
                {t("payment.reference", {
                  reference: booking.payment.reference,
                })}
              </p>
            )}
            {booking.payment.hasProof && (
              <PaymentProof
                bookingId={booking.id}
                label={t("payment.proof")}
                note={t("payment.proofDeleted", {
                  date: proofDeleteDate(booking.startAt),
                })}
              />
            )}
            {/* What the card paid in full is Stripe's to say, never a tap
                (ON12). */}
            {onPaid &&
              booking.status !== "cancelled" &&
              !paidInFullOnline(booking.priceMinor, booking.payment.online) && (
              <Button
                variant="outline"
                className="self-start"
                disabled={pending}
                onClick={() => onPaid(booking.payment?.status !== "paid")}
              >
                {t(
                  booking.payment.status === "paid"
                    ? "payment.markUnpaid"
                    : "payment.markPaid"
                )}
              </Button>
            )}
          </div>
        </>
      )}
      {booking.note && (
        <>
          <Separator />
          <p className="whitespace-pre-line">{booking.note}</p>
        </>
      )}
      {booking.customerPhone && (
        <>
          <Separator />
          <p className="text-muted-foreground">{booking.customerPhone}</p>
          <ContactButtons phone={booking.customerPhone} />
        </>
      )}
    </div>
  )
}
