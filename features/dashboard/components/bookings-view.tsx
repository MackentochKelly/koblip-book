"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@/components/ui/icons"

import { FloatingActionButton } from "@/components/floating-action-button"
import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatClock } from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import type { PeriodSummary } from "../utils/analytics"
import { presetRange } from "../utils/booking-range"
import { todayBrief } from "../utils/today-brief"
import { type BookingPanelsProps, useBookingPanels } from "./booking-panels"
import { BookingList } from "./booking-list"
import { ComingUpCard } from "./coming-up-card"
import { NewCustomersCard } from "./new-customers-card"
import { NextBookingCard } from "./next-booking-card"
import { PeriodStats } from "./period-stats"
import { SharePageCard } from "./share-page-card"
import { WidgetBoard } from "./widget-board"
import type { WidgetId, WidgetLayout } from "../widgets"

type View = "upcoming" | "past"

// Home shows this many (fewer on a phone); View all opens the Bookings
// page for the rest.
const HOME_LIMIT = 6
const HOME_PHONE_LIMIT = 3

// The home page: Add booking, then the owner's widgets (features/dashboard/
// widgets.ts) in their order: the last 7 days' numbers (they open
// Analytics), today with the assistant, the next few bookings (the last few
// one tab away) in the Bookings page's list, and the others they add.
export function BookingsView({
  upcoming,
  past,
  now,
  assistant,
  summary,
  currency,
  widgets,
  ...panelProps
}: BookingPanelsProps & {
  upcoming: OwnerBooking[]
  past: OwnerBooking[]
  // ISO time the page was loaded: what is upcoming and what can be done.
  now: string
  // The assistant's Ask card, under today's line.
  assistant?: React.ReactNode
  summary: PeriodSummary
  currency: string
  // Home's layout and what its extra widgets show.
  widgets: {
    layout: WidgetLayout
    device: boolean
    comingUp: React.ComponentProps<typeof ComingUpCard>
    newCustomers: React.ComponentProps<typeof NewCustomersCard>["customers"]
    page: { slug: string; name: string }
  }
}) {
  const [view, setView] = useState<View>("upcoming")
  const panels = useBookingPanels(panelProps)
  const { businessId, addOptions } = panelProps
  const m = useOwnerMessages()
  const t = m.bookings
  const views = [
    { id: "upcoming" as const, label: t.views.upcoming },
    { id: "past" as const, label: t.views.past },
  ]
  const list = (view === "upcoming" ? upcoming : past).slice(0, HOME_LIMIT)
  // The empty list's own Add booking button (while the Bookings widget is on
  // Home); the floating one would repeat it.
  const emptyAdd =
    list.length === 0 &&
    view === "upcoming" &&
    panels.canAdd &&
    !widgets.layout.hidden.includes("bookings")
  const brief = todayBrief([...upcoming, ...past], addOptions.today, now)
  // The table's Team column, only for a business with a team.
  const hasTeam = addOptions.team.length > 0
  // Past opens the Bookings page on the last 3 months; upcoming on its
  // usual dates.
  const last90 = presetRange("last90", addOptions.today)
  const viewAll =
    view === "upcoming"
      ? `/dashboard/${businessId}/bookings`
      : `/dashboard/${businessId}/bookings?from=${last90.from}&to=${last90.to}`

  // Today in one line, counted (no AI), then the way to ask.
  const todayCard = (
    <Card>
      <CardHeader>
        <CardTitle>
          {brief.count === 0
            ? t.brief.none
            : `${t.brief.count(brief.count)} · ${
                brief.next
                  ? t.brief.next(
                      formatClock(brief.next.time, m.locale),
                      brief.next.customerName
                    )
                  : t.brief.noneLeft
              }`}
        </CardTitle>
      </CardHeader>
      {assistant && <CardContent>{assistant}</CardContent>}
    </Card>
  )
  // Tabs to list: the same gap as between the list's rows.
  const bookingsList = (
    <div className="flex min-w-0 flex-col gap-3 md:gap-6">
      <ViewTabs
        views={views}
        value={view}
        onChange={setView}
        ariaLabel={t.title}
        listClassName="w-full md:w-fit"
      />
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDaysIcon />
            </EmptyMedia>
            <EmptyTitle>
              {view === "upcoming" ? t.noUpcoming : t.noPast}
            </EmptyTitle>
          </EmptyHeader>
          {emptyAdd && (
            <EmptyContent>
              <Button onClick={panels.add}>
                <PlusIcon data-icon="inline-start" />
                {t.addBooking}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="flex min-w-0 flex-col gap-3 md:gap-6">
          <BookingList
            // A new list (the other tab) starts sorted afresh.
            key={view}
            bookings={list}
            now={now}
            hasTeam={hasTeam}
            panels={panels}
            newestFirst={view === "past"}
            phoneLimit={HOME_PHONE_LIMIT}
          />
          {/* With only one or two bookings, they are all here already. */}
          {list.length >= HOME_PHONE_LIMIT && (
            <Button
              variant="outline"
              className="self-center"
              render={<Link href={viewAll} />}
              nativeButton={false}
            >
              {t.viewAll}
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* On a phone the top bar names the page and Add floats at the foot,
          so this header row only shows on a computer. */}
      <div className="flex items-center justify-between gap-3 max-md:contents">
        {/* Home on a phone, like its tab; Dashboard on a computer. */}
        <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">
          <span className="md:hidden">{m.shell.nav.home}</span>
          <span className="max-md:hidden">{m.shell.nav.dashboard}</span>
        </h1>
        <Button
          className="max-md:hidden"
          onClick={panels.add}
          disabled={!panels.canAdd}
        >
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>
      <WidgetBoard
        businessId={businessId}
        layout={widgets.layout}
        device={widgets.device}
        widgets={
          {
            stats: (
              <PeriodStats
                summary={summary}
                currency={currency}
                href={`/dashboard/${businessId}/analytics`}
              />
            ),
            today: todayCard,
            bookings: bookingsList,
            next: (
              <NextBookingCard
                booking={
                  upcoming.find((booking) => booking.status === "confirmed") ??
                  null
                }
                onOpen={panels.open}
              />
            ),
            chart: <ComingUpCard {...widgets.comingUp} />,
            newCustomers: (
              <NewCustomersCard
                customers={widgets.newCustomers}
                href={`/dashboard/${businessId}/customers`}
              />
            ),
            share: <SharePageCard {...widgets.page} />,
          } satisfies Record<WidgetId, React.ReactNode>
        }
      />

      {!emptyAdd && (
        <FloatingActionButton
          label={t.addBooking}
          onClick={panels.add}
          disabled={!panels.canAdd}
        >
          <PlusIcon />
        </FloatingActionButton>
      )}

      {panels.panels}
    </div>
  )
}
