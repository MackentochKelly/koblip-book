"use client"

import { useState } from "react"
import { CalendarDaysIcon, PlusIcon } from "@/components/ui/icons"

import { FloatingActionButton } from "@/components/floating-action-button"
import { ViewAllLink } from "@/components/view-all-link"
import { ViewTabs } from "@/components/view-tabs"
import { Button } from "@/components/ui/button"
import { HelperLine } from "@/components/helper-line"
import { Card, CardContent } from "@/components/ui/card"
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
import { InstallAppCard } from "./install-app-card"
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
  greeting,
  setup,
  assistant,
  summary,
  currency,
  widgets,
  ...panelProps
}: BookingPanelsProps & {
  upcoming: OwnerBooking[]
  past: OwnerBooking[]
  // "Good afternoon, Kelly", made on the server by the business's clock.
  greeting: string
  // The Get set up list, under the greeting until every step is done.
  setup?: React.ReactNode
  // ISO time the page was loaded: what is upcoming and what can be done.
  now: string
  // The assistant's Ask card, the Assistant widget's only part.
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

  // Today in one line, counted (no AI), under the greeting.
  const briefLine =
    brief.count === 0
      ? t.brief.none
      : `${t.brief.count(brief.count)} · ${
          brief.next
            ? t.brief.next(
                formatClock(brief.next.time, m.locale),
                brief.next.customerName
              )
            : t.brief.noneLeft
        }`
  // The Assistant widget: only the way to ask.
  const assistantCard = assistant && (
    <Card>
      <CardContent>{assistant}</CardContent>
    </Card>
  )
  // Tabs to list: the same gap as between the list's rows.
  const bookingsList = (
    <div className="flex min-w-0 flex-col gap-3 md:gap-6">
      {/* The tabs, and View all at the top right when there are more. */}
      <div className="flex items-center justify-between gap-3">
        <ViewTabs
          views={views}
          value={view}
          onChange={setView}
          ariaLabel={t.title}
          className="min-w-0 flex-1 md:flex-none"
          listClassName="w-full md:w-fit"
        />
        {/* With only one or two bookings, they are all here already. */}
        {list.length >= HOME_PHONE_LIMIT && (
          <ViewAllLink href={viewAll} label={t.viewAll} />
        )}
      </div>
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
              {/* Outline, filled with its hover gray so it reads as a button;
                  the header's Add is the page's main action. */}
              <Button
                variant="outline"
                className="bg-muted hover:bg-input/50"
                onClick={panels.add}
              >
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
            today={addOptions.today}
            hasTeam={hasTeam}
            panels={panels}
            newestFirst={view === "past"}
            phoneLimit={HOME_PHONE_LIMIT}
          />
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* On a phone the top bar names the page and Add floats at the foot,
          so this header row only shows on a computer. */}
      <div className="flex items-center justify-between gap-3 max-md:contents">
        {/* The greeting with today's line under it. The page's name is only
            for screen readers: the top bar or sidebar shows it. */}
        <div className="flex flex-col">
          {/* Home on a phone, like its tab; Dashboard on a computer. */}
          <h1 className="sr-only">
            <span className="md:hidden">{m.shell.nav.home}</span>
            <span className="max-md:hidden">{m.shell.nav.dashboard}</span>
          </h1>
          <p className="text-2xl font-semibold tracking-tight">{greeting}</p>
          <HelperLine>{briefLine}</HelperLine>
        </div>
        <Button
          className="max-md:hidden"
          onClick={panels.add}
          disabled={!panels.canAdd}
        >
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>
      {setup}
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
            today: assistantCard,
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
            install: <InstallAppCard />,
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
