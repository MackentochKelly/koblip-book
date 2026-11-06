"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { TimePicker } from "@/components/time-picker"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { myBookingsHref, myBookingsLoginHref } from "@/lib/my-bookings-links"
import { todayIn } from "@/lib/format-booking-time"
import { languageOf } from "@/lib/page-language"
import { moveCustomerBooking } from "../api/move-customer-booking"
import type { Availability } from "../types"
import { useTimeLabels } from "./booking-steps"

// The customer picks a new free time for their booking (same person and
// length), then moves it with one button, back to My bookings.
export function RescheduleForm({
  bookingId,
  availability,
  timeZone,
}: {
  bookingId: string
  availability: Availability
  timeZone: string
}) {
  const t = useTranslations("public.account")
  const booking = useTranslations("public.booking")
  const timeLabels = useTimeLabels()
  const locale = useLocale()
  const language = languageOf(locale)
  const router = useRouter()
  const [picked, setPicked] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const free = availability.days.filter((day) => day.times.length > 0)
  if (free.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{booking("noTimes")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  const date =
    picked && free.some((day) => day.date === picked) ? picked : free[0].date

  const move = () => {
    if (!time) return
    startTransition(async () => {
      const result = await moveCustomerBooking({ bookingId, date, time })
      if (result.status === "moved") {
        toast.success(t("moved"))
        router.replace(myBookingsHref(language))
      } else if (result.status === "signedOut") {
        router.replace(myBookingsLoginHref(language))
      } else if (result.status === "taken") {
        toast.error(t("timeTaken"))
        setTime(null)
        router.refresh()
      } else {
        toast.error(t("actionFailed"))
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <TimePicker
        days={availability.days}
        date={date}
        onDateChange={(next) => {
          setPicked(next)
          setTime(null)
        }}
        time={time}
        onTimeChange={setTime}
        today={todayIn(timeZone)}
        locale={locale}
        labels={timeLabels}
      />
      <Button size="lg" disabled={!time || busy} onClick={move}>
        {busy && <Spinner data-icon="inline-start" />}
        {busy ? t("moving") : t("moveTo")}
      </Button>
    </div>
  )
}
