"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { CopyButton } from "@/components/copy-button"
import { PageSection } from "@/components/page-section"
import { PaymentBadge } from "@/components/payment-badge"
import { PaymentProof } from "@/components/payment-proof"
import { PaymentProofField } from "@/components/payment-proof-field"
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
import {
  canReportPayment,
  PAYMENT_RULES,
  proofDeleteDate,
} from "@/lib/payment-rules"
import { resizeImage } from "@/lib/resize-image"
import { UPLOAD_RULES } from "@/lib/upload-rules"
import { replacePaymentProof, reportPayment } from "../api/report-payment"
import type { MyBooking } from "../types"

// How the customer chose to pay the business outside the app: where to
// send the money, and where it stands. "I've paid" only asks the business
// to check; the business is the one that marks it paid. A business that
// asks for a picture of the payment (docs/plans/payment-proof.md) gets one
// with it: "I've paid" waits for the picture, and it can be replaced until
// the business answers.
const ACCEPT = Object.keys(UPLOAD_RULES.types).join(",")

export function BookingPayment({ booking }: { booking: MyBooking }) {
  const t = useTranslations("public.account.payment")
  const language = languageOf(useLocale())
  const router = useRouter()
  const [reference, setReference] = useState("")
  const [busy, startTransition] = useTransition()
  // The payment proof picked for "I've paid".
  const [picture, setPicture] = useState<File | null>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const payment = booking.payment
  if (!payment) return null

  // Why a picture was refused, or the plain "try again".
  const failed = (error: string | undefined) => {
    if (error === "signedOut") {
      router.replace(myBookingsLoginHref(language))
      return
    }
    toast.error(
      error === "proofMissing"
        ? t("proofMissing")
        : error === "too_big"
          ? t("proofTooBig")
          : error === "wrong_type"
            ? t("proofWrongType")
            : t("failed")
    )
    router.refresh()
  }
  const report = () =>
    startTransition(async () => {
      const formData = new FormData()
      formData.set("bookingId", booking.id)
      formData.set("reference", reference)
      if (picture) formData.set("file", await resizeImage(picture))
      const result = await reportPayment(formData).catch(() => null)
      if (result?.ok) {
        toast.success(t("reported", { business: booking.business.name }))
        router.refresh()
      } else {
        failed(result?.error)
      }
    })
  const replace = (file: File) =>
    startTransition(async () => {
      const formData = new FormData()
      formData.set("bookingId", booking.id)
      formData.set("file", await resizeImage(file))
      const result = await replacePaymentProof(formData).catch(() => null)
      if (result?.ok) {
        toast.success(t("proofReplaced"))
        router.refresh()
      } else {
        failed(result?.error)
      }
    })
  const deleted = t("proofDeleted", { date: proofDeleteDate(booking.calendar.startAt) })

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
          {payment.method && (
            <CopyButton
              value={payment.method.details}
              copyLabel={t("copy")}
              copiedLabel={t("copied")}
              failedLabel={t("failed")}
            />
          )}
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
              {booking.asksProof && (
                <PaymentProofField
                  value={picture}
                  onChange={setPicture}
                  disabled={busy}
                  addLabel={t("addProof")}
                  replaceLabel={t("replaceProof")}
                  hint={t("proofHint", { days: PAYMENT_RULES.proofKeepDays })}
                />
              )}
              <Button
                type="submit"
                className="self-end"
                disabled={busy || (booking.asksProof && !picture)}
              >
                {busy && <Spinner data-icon="inline-start" />}
                {t("paid")}
              </Button>
            </form>
          </Item>
        )}
        {payment.hasProof && (
          <Item variant="box">
            <ItemContent className="gap-3">
              <PaymentProof
                bookingId={booking.id}
                label={t("proof")}
                note={deleted}
              />
              <ItemDescription>{deleted}</ItemDescription>
            </ItemContent>
            {payment.status === "reported" && booking.asksProof && (
              <>
                <Input
                  ref={replaceInput}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) replace(file)
                  }}
                />
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => replaceInput.current?.click()}
                >
                  {busy && <Spinner data-icon="inline-start" />}
                  {t("replaceProof")}
                </Button>
              </>
            )}
          </Item>
        )}
      </ItemGroup>
    </PageSection>
  )
}
