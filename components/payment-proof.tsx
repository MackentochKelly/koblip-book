"use client"

import { useState } from "react"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { ImageIcon } from "@/components/ui/icons"
import { paymentProofPath } from "@/lib/payment-rules"

// A booking's payment picture (docs/plans/payment-proof.md): a button that
// opens it in a panel, with the day it will be deleted. The picture is
// asked for only when the panel opens, from an address that answers only
// the people allowed to see it. Words come from the caller's area.
export function PaymentProof({
  bookingId,
  label,
  note,
}: {
  bookingId: string
  // The button and the panel's title: "Payment picture".
  label: string
  // One short line under the title: "Deleted on 12 Feb 2027".
  note?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        className="self-start"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <ImageIcon data-icon="inline-start" />
        {label}
      </Button>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        description={note}
      >
        {open && (
          // eslint-disable-next-line @next/next/no-img-element -- a private picture: next/image would fetch it without the viewer's session and keep a copy
          <img
            src={paymentProofPath(bookingId)}
            alt={label}
            className="w-full rounded-md"
          />
        )}
      </ResponsivePanel>
    </>
  )
}
