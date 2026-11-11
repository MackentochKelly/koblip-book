"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatPrice } from "@/lib/format-price"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import { cantCome } from "../api/cant-come"
import type { MyBooking } from "../types"

// An upcoming booking's red "Cancel", asked once more before it goes. It
// cancels where the business lets customers cancel; else the dialog says
// it tells the owner they can't make it, and the booking stays.
export function CantComeButton({ booking }: { booking: MyBooking }) {
  const t = useTranslations("public.account")
  const locale = useLocale()
  const language = languageOf(locale)
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, startTransition] = useTransition()

  if (!booking.cantCome) return null
  if (booking.cantCome === "alertOnly" && booking.saidCantCome) {
    return (
      <Button variant="outline" disabled>
        {t("told")}
      </Button>
    )
  }
  const cancels = booking.cantCome === "cancel"
  // Paid by card: cancelling gives nothing back by itself; the business
  // decides (docs/plans/online-payments.md, ON10). Said before they cancel.
  const online = booking.payment?.online
  const paid = online ? online.paidMinor - online.refundedMinor : 0

  const confirm = () =>
    startTransition(async () => {
      const result = await cantCome(booking.id).catch(() => null)
      if (result?.ok) {
        if (result.cancelled) toast.success(t("cancelDone"))
        router.refresh()
      } else if (result?.error === "signedOut") {
        router.replace(myBookingsLoginHref(language))
      } else {
        toast.error(t("actionFailed"))
        router.refresh()
      }
    })

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => setAsking(true)}
      >
        {busy && <Spinner data-icon="inline-start" />}
        {t("cancel")}
      </Button>
      <ConfirmDialog
        open={asking}
        title={cancels ? t("cancelTitle") : t("cantComeTitle")}
        description={
          cancels && paid > 0
            ? t("cancelPaid", {
                business: booking.business.name,
                amount: formatPrice(paid, booking.currency, locale),
              })
            : t("willBeTold", { business: booking.business.name })
        }
        confirm={cancels ? t("cancelBooking") : t("tellThem")}
        cancel={t("keep")}
        tone={cancels ? "destructive" : "default"}
        onConfirm={confirm}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
