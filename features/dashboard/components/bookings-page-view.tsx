"use client"

import { useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import type { DayRangeValue } from "@/components/date-range-picker"
import { FloatingActionButton } from "@/components/floating-action-button"
import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "@/components/ui/icons"
import { cn } from "cn"
import type { OwnerBooking } from "../types"
import { type BookingPanelsProps, useBookingPanels } from "./booking-panels"
import { BookingsCalendar } from "./bookings-calendar"
import { BookingsTable } from "./bookings-table"

export type BookingsTab = "bookings" | "calendar"

// The Bookings page: every booking as a list (Bookings) or by day
// (Calendar). The tab, dates and month live in the address, so the server
// loads just what is shown and a link opens the same view.
export function BookingsPageView({
  tab,
  bookings,
  range,
  month,
  today,
  now,
  ...panelProps
}: BookingPanelsProps & {
  tab: BookingsTab
  bookings: OwnerBooking[]
  range: DayRangeValue
  month: string
  today: string
  now: string
}) {
  const t = useTranslations("owner.bookings")
  const router = useRouter()
  const pathname = usePathname()
  const [loading, startTransition] = useTransition()
  const panels = useBookingPanels(panelProps)
  const { services, categories, team } = panelProps.addOptions

  // Only what differs from where the page opens goes in the address.
  const go = (next: { tab?: BookingsTab; range?: DayRangeValue; month?: string }) => {
    const params = new URLSearchParams()
    const nextTab = next.tab ?? tab
    if (nextTab === "calendar") {
      params.set("view", "calendar")
      params.set("month", next.month ?? month)
    } else {
      const nextRange = next.range ?? range
      params.set("from", nextRange.from)
      params.set("to", nextRange.to)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params}`, { scroll: false })
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
          {t("title")}
        </h1>
        <div className="flex items-center gap-3">
          <ViewTabs
            views={[
              { id: "bookings" as const, label: t("list.tabs.bookings") },
              { id: "calendar" as const, label: t("list.tabs.calendar") },
            ]}
            value={tab}
            onChange={(next) => go({ tab: next })}
            ariaLabel={t("title")}
            className="max-md:flex-1"
            listClassName="w-full md:w-fit"
          />
          {/* On a phone Add floats at the foot. */}
          <Button
            className="max-md:hidden"
            onClick={panels.add}
            disabled={!panels.canAdd}
          >
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </div>
      </div>

      {/* While the next dates or month load, the old ones fade. */}
      <div
        aria-busy={loading}
        className={cn("transition-opacity", loading && "opacity-60")}
      >
        {tab === "bookings" ? (
          <BookingsTable
            bookings={bookings}
            now={now}
            today={today}
            range={range}
            onRangeChange={(next) => go({ range: next })}
            services={services}
            categories={categories}
            team={team}
            panels={panels}
          />
        ) : (
          <BookingsCalendar
            bookings={bookings}
            month={month}
            onMonthChange={(next) => go({ month: next })}
            today={today}
            now={now}
            team={team}
            panels={panels}
          />
        )}
      </div>

      <FloatingActionButton
        label={t("addBooking")}
        onClick={panels.add}
        disabled={!panels.canAdd}
      >
        <PlusIcon />
      </FloatingActionButton>

      {panels.panels}
    </div>
  )
}
