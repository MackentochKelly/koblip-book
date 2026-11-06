"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CalendarIcon,
  ChevronDownIcon,
  DownloadIcon,
} from "@/components/ui/icons"
import { googleCalendarHref } from "@/lib/booking-calendar"
import type { MyBooking } from "../types"

// "Add to calendar" for a booking still ahead (D12): the calendar file any
// calendar app opens, or Google Calendar's own page.
export function AddToCalendar({ booking }: { booking: MyBooking }) {
  const t = useTranslations("public.account.booking")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {t("addToCalendar")}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={
            <a
              href={`/api/account/bookings/${encodeURIComponent(booking.id)}/calendar`}
              download
            />
          }
        >
          <DownloadIcon />
          {t("calendarFile")}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={googleCalendarHref(booking.calendar)}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <CalendarIcon />
          {t("googleCalendar")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
