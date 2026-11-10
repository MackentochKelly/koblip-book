"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { PaymentBadge } from "@/components/payment-badge"
import { PaymentTypeIcon } from "@/components/payment-type-icon"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { ClockIcon } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import { canReportPayment, PAYMENT_RULES } from "@/lib/payment-rules"
import { reportPayment } from "../api/report-payment"
import type { MyBooking } from "../types"

// How the customer chose to pay the business outside the app: where to
// send the money, and where it stands. "I've paid" only asks the business
// to check; the business is the one that marks it paid.
export function BookingPayment({ booking }: { booking: MyBooking }) {
  const t = useTranslations("public.account.payment")
  const language = languageOf(useLocale())
  const router = useRouter()
  const [reference, setReference] = useState("")
  const [busy, startTransition] = useTransition()
  const payment = booking.payment
  if (!payment) return null

  const report = () =>
    startTransition(async () => {
      const result = await reportPayment(booking.id, reference).catch(
        () => null
      )
      if (result?.ok) {
        toast.success(t("reported", { business: booking.business.name }))
        router.refresh()
      } else if (result?.error === "signedOut") {
        router.replace(myBookingsLoginHref(language))
      } else {
        toast.error(t("failed"))
        router.refresh()
      }
    })

  return (
    <PageSection
      id="payment"
      title={t("title")}
      action={
        <PaymentBadge
          status={payment.status}
          label={t(`status.${payment.status}`)}
        />
      }
    >
      <ItemGroup className="gap-3">
        <Item variant="box">
          <ItemMedia variant="icon">
            {payment.method ? (
              <PaymentTypeIcon type={payment.method.type} />
            ) : (
              <ClockIcon />
            )}
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemDescription>
              {payment.method?.name ?? t("later")}
            </ItemDescription>
            <ItemTitle className="w-full break-words whitespace-pre-line">
              {payment.method?.details ?? t("atVisit")}
            </ItemTitle>
          </ItemContent>
        </Item>
        {canReportPayment(payment) && (
          <Item variant="box">
            <form
              className="flex w-full flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                report()
              }}
            >
              <Field>
                <FieldLabel htmlFor="payment-reference">
                  {t("reference")}
                </FieldLabel>
                <Input
                  id="payment-reference"
                  className="min-h-11 md:min-h-9"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={PAYMENT_RULES.maxReference}
                  placeholder={t("optional")}
                  autoComplete="off"
                />
              </Field>
              <Button type="submit" className="self-end" disabled={busy}>
                {busy && <Spinner data-icon="inline-start" />}
                {t("paid")}
              </Button>
            </form>
          </Item>
        )}
      </ItemGroup>
    </PageSection>
  )
}
