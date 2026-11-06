"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useMessages, usePageLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { CUSTOMER_SIGN_IN_PATH } from "@/lib/customer-auth-path"
import { cantCome } from "../api/cant-come"
import type { MyBooking } from "../types"

// An upcoming booking's "I can't come", asked once more before it goes:
// "Cancel" where the business lets customers cancel, else "Can't make it",
// which tells the owner and keeps the booking.
export function CantComeButton({ booking }: { booking: MyBooking }) {
  const m = useMessages()
  const t = m.account
  const language = usePageLanguage()
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, startTransition] = useTransition()

  if (!booking.cantCome) return null
  if (booking.cantCome === "alertOnly" && booking.saidCantCome) {
    return <Badge variant="secondary">{t.told}</Badge>
  }
  const cancels = booking.cantCome === "cancel"

  const confirm = () =>
    startTransition(async () => {
      const result = await cantCome(booking.id).catch(() => null)
      if (result?.ok) {
        if (result.cancelled) toast.success(t.cancelDone)
        router.refresh()
      } else if (result?.error === "signedOut") {
        router.replace(`${CUSTOMER_SIGN_IN_PATH}?lang=${language}`)
      } else {
        toast.error(t.actionFailed)
        router.refresh()
      }
    })

  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => setAsking(true)}>
        {busy && <Spinner data-icon="inline-start" />}
        {cancels ? t.cancel : t.cantCome}
      </Button>
      <ConfirmDialog
        open={asking}
        title={cancels ? t.cancelTitle : t.cantComeTitle}
        description={t.willBeTold(booking.business.name)}
        confirm={cancels ? t.cancelBooking : t.tellThem}
        cancel={t.keep}
        tone={cancels ? "destructive" : "default"}
        onConfirm={confirm}
        onClose={() => setAsking(false)}
      />
    </>
  )
}
