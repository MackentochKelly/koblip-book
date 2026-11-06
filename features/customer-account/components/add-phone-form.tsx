"use client"

import { useRouter } from "next/navigation"

import { useMessages } from "@/components/language-provider"
import { PhoneCodeForm } from "@/components/phone-code-form"

// A signed-in account with no phone yet adds the one it booked with, by a
// code sent to it; then My bookings shows that phone's bookings.
export function AddPhoneForm() {
  const m = useMessages()
  const router = useRouter()
  return (
    <PhoneCodeForm
      purpose="addPhone"
      onDone={() => router.refresh()}
      labels={{ ...m.account, phone: m.booking.phone }}
      locale={m.locale}
    />
  )
}
