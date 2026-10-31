"use client"

import { useState } from "react"
import { es } from "react-day-picker/locale"

import { DayStrip } from "@/components/day-strip"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ChevronRightIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  addDaysTo,
  dateFromDay,
  dayFromDate,
  formatClock,
  formatDay,
} from "@/lib/format-booking-time"
import { cn } from "cn"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import { type BookingState, bookingState } from "../utils/booking-filters"
import { monthRange } from "../utils/booking-range"
import type { useBookingPanels } from "./booking-panels"
import { BookingStateBadge } from "./booking-state-badge"

// Each 15 minutes is one row of the day's grid.
const SLOT_MINUTES = 15
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES

// A block's colours by where the booking stands, the badges' soft look.
const BLOCK: Record<BookingState, string> = {
  upcoming: "border-l-info bg-info/10",
  unmarked: "border-l-warning bg-warning/10",
  completed: "border-l-success bg-success/10",
  no_show: "border-l-destructive bg-destructive/10",
  cancelled: "border-l-border bg-muted text-muted-foreground line-through",
}

// The Calendar tab: a month with how many bookings each day has; tapping a
// day shows it. A computer lays the day out as a time grid, one column per
// team member; a phone lists it.
export function BookingsCalendar({
  bookings,
  month,
  onMonthChange,
  today,
  now,
  team,
  panels,
}: {
  bookings: OwnerBooking[]
  month: string // "YYYY-MM"
  onMonthChange: (month: string) => void
  today: string
  now: string
  team: { id: string; name: string }[]
  panels: ReturnType<typeof useBookingPanels>
}) {
  const m = useOwnerMessages()
  const t = m.bookings.calendar
  const [picked, setPicked] = useState<string | null>(null)
  // The phone's row: the month and a week either side, the days loaded.
  const shown = monthRange(month)
  // The day shown: the one tapped (while its month loads too), else today
  // in today's month, else the 1st.
  const day =
    picked !== null && picked >= shown.from && picked <= shown.to
      ? picked
      : today.startsWith(month)
        ? today
        : `${month}-01`
  const perDay = new Map<string, number>()
  for (const booking of bookings) {
    if (booking.status === "cancelled") continue
    perDay.set(booking.date, (perDay.get(booking.date) ?? 0) + 1)
  }
  const dayBookings = bookings.filter((booking) => booking.date === day)
  const count = perDay.get(day) ?? 0
  const rowDays: string[] = []
  for (let date = shown.from; date <= shown.to; date = addDaysTo(date, 1)) {
    rowDays.push(date)
  }
  // A day from another month opens that month too.
  const pick = (next: string) => {
    setPicked(next)
    if (!next.startsWith(month)) onMonthChange(next.slice(0, 7))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
      {/* A phone picks the day from a row, as on the booking page. */}
      <div className="min-w-0 md:hidden">
        <DayStrip
          days={rowDays}
          value={day}
          onChange={pick}
          today={today}
          locale={m.locale}
          labels={t}
          note={(date) => {
            const booked = perDay.get(date) ?? 0
            return (
              <span className={cn(booked === 0 && "invisible")}>{booked}</span>
            )
          }}
        />
      </div>
      <Card className="py-0 max-md:hidden">
        <CardContent className="p-2">
          <Calendar
            mode="single"
            required
            locale={m.locale.startsWith("es") ? es : undefined}
            month={dateFromDay(`${month}-01`)}
            onMonthChange={(date) => {
              // A new month opens on today or its 1st.
              setPicked(null)
              onMonthChange(dayFromDate(date).slice(0, 7))
            }}
            selected={dateFromDay(day)}
            onSelect={(date) => pick(dayFromDate(date))}
            className="[--cell-size:--spacing(11)]"
            classNames={{ root: "mx-auto w-fit" }}
            components={{
              DayButton: ({ children, ...props }) => {
                const booked = perDay.get(dayFromDate(props.day.date)) ?? 0
                return (
                  <CalendarDayButton {...props}>
                    {children}
                    {/* How many that day; the button's own small line. */}
                    <span className={cn(booked === 0 && "invisible")}>
                      {booked}
                    </span>
                  </CalendarDayButton>
                )
              },
            }}
          />
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{formatDay(day, m.locale)}</CardTitle>
          <CardDescription>{t.count(count)}</CardDescription>
        </CardHeader>
        <CardContent>
          {dayBookings.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t.free}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ItemGroup className="gap-3 md:hidden">
                {dayBookings.map((booking) => (
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
                        <BookingStateBadge state={bookingState(booking, now)} />
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
              <DayGrid
                bookings={dayBookings}
                team={team}
                now={now}
                onOpen={(booking) => panels.open(booking, Date.now())}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const minutesOf = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

// One day as a time grid (a computer): hours down the side, a column per
// team member (and "Anyone" for bookings no one was given), each booking a
// block as long as it lasts.
function DayGrid({
  bookings,
  team,
  now,
  onOpen,
}: {
  bookings: OwnerBooking[]
  team: { id: string; name: string }[]
  now: string
  onOpen: (booking: OwnerBooking) => void
}) {
  const m = useOwnerMessages()
  const t = m.bookings.calendar
  // Whole hours around the day's bookings, at least 9 to 5.
  const firstHour = Math.min(
    9,
    ...bookings.map((booking) => Math.floor(minutesOf(booking.time) / 60))
  )
  const lastHour = Math.max(
    17,
    ...bookings.map((booking) => {
      const end = minutesOf(booking.endTime) || 24 * 60
      return Math.ceil(end / 60)
    })
  )
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, index) => firstHour + index
  )
  const columns = [
    ...team
      .filter((member) =>
        // Only the people working that day, when someone has bookings.
        bookings.some((booking) => booking.teamMemberId === member.id)
      )
      .map((member) => ({ id: member.id, name: member.name })),
    ...(bookings.some((booking) => booking.teamMemberId === null)
      ? [{ id: null, name: team.length > 0 ? t.anyone : "" }]
      : []),
  ]
  const slot = (time: string) =>
    Math.floor((minutesOf(time) - firstHour * 60) / SLOT_MINUTES) + 2

  return (
    <div
      className="grid gap-x-2 max-md:hidden"
      style={{
        gridTemplateColumns: `auto repeat(${columns.length}, minmax(0, 1fr))`,
        gridTemplateRows: `auto repeat(${hours.length * SLOTS_PER_HOUR}, calc(var(--spacing) * 5))`,
      }}
    >
      {/* The column names, when there is more than one person. */}
      {columns.map((column, index) => (
        <div
          key={column.id ?? "anyone"}
          className="truncate pb-2 font-medium"
          style={{ gridColumn: index + 2, gridRow: 1 }}
        >
          {columns.length > 1 || team.length > 0 ? column.name : ""}
        </div>
      ))}
      {hours.map((hour, index) => (
        <div
          key={hour}
          className="-mt-2 pr-2 text-xs text-muted-foreground tabular-nums"
          style={{
            gridColumn: 1,
            gridRow: `${index * SLOTS_PER_HOUR + 2} / span ${SLOTS_PER_HOUR}`,
          }}
        >
          {formatClock(`${String(hour).padStart(2, "0")}:00`, m.locale)}
        </div>
      ))}
      {/* A line at each hour, across every column. */}
      {hours.map((hour, index) => (
        <div
          key={`line-${hour}`}
          aria-hidden
          className="border-t"
          style={{
            gridColumn: `2 / span ${columns.length}`,
            gridRow: index * SLOTS_PER_HOUR + 2,
          }}
        />
      ))}
      {bookings.map((booking) => {
        const start = slot(booking.time)
        const end = Math.max(
          start + 1,
          booking.endTime > booking.time
            ? slot(booking.endTime)
            : (lastHour - firstHour) * SLOTS_PER_HOUR + 2
        )
        const column = columns.findIndex(
          (item) => item.id === booking.teamMemberId
        )
        const state = bookingState(booking, now)
        return (
          <Button
            key={booking.id}
            variant="ghost"
            onClick={() => onOpen(booking)}
            className={cn(
              "z-10 h-auto min-h-0 flex-col items-start justify-start gap-0 overflow-hidden rounded-xl border-transparent border-l-4 px-2 py-1 text-left text-xs font-normal whitespace-normal",
              BLOCK[state]
            )}
            style={{
              gridColumn: column + 2,
              gridRow: `${start} / ${end}`,
            }}
          >
            <span className="font-medium">{booking.customerName}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatClock(booking.time, m.locale)} · {booking.serviceName}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
