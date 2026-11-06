"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { BOOKING_CLAIM_KEY } from "@/lib/my-bookings-links"
import { claimBooking } from "../api/claim-booking"

// Booked signed out, then logged in from "Manage your booking": the
// booking this tab kept a claim for joins the account, then the list
// shows it. The claim is used once, whatever the answer.
export function ClaimBooking() {
  const router = useRouter()
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem(BOOKING_CLAIM_KEY)
      sessionStorage.removeItem(BOOKING_CLAIM_KEY)
    } catch {}
    if (!saved) return
    let claim: { bookingId?: unknown; token?: unknown }
    try {
      claim = JSON.parse(saved)
    } catch {
      return
    }
    void claimBooking({ bookingId: claim.bookingId, token: claim.token })
      .then(({ claimed }) => {
        if (claimed) router.refresh()
      })
      .catch(() => {})
  }, [router])
  return null
}
