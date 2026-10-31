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
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import type { PeriodSummary } from "../utils/analytics"
import { presetRange } from "../utils/booking-range"
import { type BookingPanelsProps, useBookingPanels } from "./booking-panels"
import { BookingStatusBadge } from "./booking-status-badge"
import { PeriodStats } from "./period-stats"

type View = "upcoming" | "past"

// Home shows this many; View all opens the Bookings page for the rest.
const HOME_LIMIT = 8

// The home page: the last 7 days' numbers (they open Analytics), then the
// next few bookings by day (the last few one tab away), and View all for
// the Bookings page. Each opens its details, as on the Bookings page.
export function BookingsView({
  upcoming,
  past,
  summary,
  currency,
  ...panelProps
}: BookingPanelsProps & {
  upcoming: OwnerBooking[]
  past: OwnerBooking[]
  summary: PeriodSummary
  currency: string
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
  const days = groupByDay(list)
  // The table's Team column, only for a business with a team.
  const hasTeam = addOptions.team.length > 0
  // Past opens the Bookings page on the last 3 months; upcoming on its
  // usual dates.
  const last90 = presetRange("last90", addOptions.today)
  const viewAll =
    view === "upcoming"
      ? `/dashboard/${businessId}/bookings`
      : `/dashboard/${businessId}/bookings?from=${last90.from}&to=${last90.to}`

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
      <PeriodStats
        summary={summary}
        currency={currency}
        href={`/dashboard/${businessId}/analytics`}
      />
      <div className="flex min-w-0 flex-col gap-6">
        <ViewTabs
          views={views}
          value={view}
          onChange={setView}
          ariaLabel={t.title}
          listClassName="w-full md:w-fit"
        />
        {days.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDaysIcon />
              </EmptyMedia>
              <EmptyTitle>
                {view === "upcoming" ? t.noUpcoming : t.noPast}
              </EmptyTitle>
            </EmptyHeader>
            {view === "upcoming" && panels.canAdd && (
              <EmptyContent>
                <Button onClick={panels.add}>
                  <PlusIcon data-icon="inline-start" />
                  {t.addBooking}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <>
            {/* A phone lists each day's bookings. */}
            <div className="flex flex-col gap-6 md:hidden">
              {days.map(([date, bookings]) => (
                <section
                  key={date}
                  className="flex flex-col gap-3"
                  aria-label={formatDay(date, m.locale)}
                >
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {formatDay(date, m.locale)}
                  </h2>
                  <ItemGroup className="gap-3">
                    {bookings.map((booking) => (
                      <Item
                        key={booking.id}
                        variant="outline"
                        render={
                          <button
                            type="button"
                            onClick={() => panels.open(booking, Date.now())}
                          />
                        }
                        className="text-left"
                      >
                        <ItemContent>
                          <ItemTitle>
                            {formatClock(booking.time, m.locale)} –{" "}
                            {formatClock(booking.endTime, m.locale)}
                            <BookingStatusBadge status={booking.status} />
                          </ItemTitle>
                          <ItemDescription>
                            {booking.customerName} · {booking.serviceName}
                            {booking.teamMemberName &&
                              ` · ${booking.teamMemberName}`}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <ChevronRightIcon />
                        </ItemActions>
                      </Item>
                    ))}
                  </ItemGroup>
                </section>
              ))}
            </div>
            {/* A computer shows one table, each day a heading row, so the
                  columns line up from day to day. */}
            <Card className="py-0 max-md:hidden">
              <Table className="[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columns.time}</TableHead>
                    <TableHead>{t.columns.customer}</TableHead>
                    <TableHead>{t.columns.service}</TableHead>
                    {hasTeam && <TableHead>{t.columns.team}</TableHead>}
                  </TableRow>
                </TableHeader>
                {days.map(([date, bookings]) => (
                  <TableBody key={date}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead
                        scope="colgroup"
                        colSpan={hasTeam ? 4 : 3}
                        className="h-8 text-xs text-muted-foreground"
                      >
                        {formatDay(date, m.locale)}
                      </TableHead>
                    </TableRow>
                    {bookings.map((booking) => (
                      // The whole row opens the booking for a mouse; the
                      // customer's name is its button for the keyboard.
                      <TableRow
                        key={booking.id}
                        className="cursor-pointer"
                        onClick={() => panels.open(booking, Date.now())}
                      >
                        {/* The status sits by the time, as on a phone. */}
                        <TableCell className="tabular-nums">
                          <span className="flex items-center gap-2">
                            {formatClock(booking.time, m.locale)} –{" "}
                            {formatClock(booking.endTime, m.locale)}
                            <BookingStatusBadge status={booking.status} />
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="h-auto p-0 text-foreground"
                            onClick={(event) => {
                              event.stopPropagation()
                              panels.open(booking, Date.now())
                            }}
                          >
                            {booking.customerName}
                          </Button>
                        </TableCell>
                        <TableCell>{booking.serviceName}</TableCell>
                        {hasTeam && (
                          <TableCell>{booking.teamMemberName}</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                ))}
              </Table>
            </Card>
            <Button
              variant="outline"
              className="self-center max-md:w-full"
              render={<Link href={viewAll} />}
              nativeButton={false}
            >
              {t.viewAll}
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </>
        )}
      </div>

      <FloatingActionButton
        label={t.addBooking}
        onClick={panels.add}
        disabled={!panels.canAdd}
      >
        <PlusIcon />
      </FloatingActionButton>

      {panels.panels}
    </div>
  )
}

function groupByDay(bookings: OwnerBooking[]): Array<[string, OwnerBooking[]]> {
  const days = new Map<string, OwnerBooking[]>()
  for (const booking of bookings) {
    const day = days.get(booking.date) ?? []
    day.push(booking)
    days.set(booking.date, day)
  }
  return [...days]
}
