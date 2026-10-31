"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { FloatingActionButton } from "@/components/floating-action-button"
import { ResponsivePanel } from "@/components/responsive-panel"
import { StatCards } from "@/components/stat-cards"
import { ViewTabs } from "@/components/view-tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
  OwnerMoveInput,
  OwnerMoveResult,
} from "@/types/owner-booking"
import { cancelBooking } from "../api/actions"
import { setBookingStatus } from "../api/booking-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import { AddBookingPanel, type AddBookingOptions } from "./add-booking-panel"
import { BookingDetails } from "./booking-details"
import { BookingStatusBadge } from "./booking-status-badge"
import { MoveBookingPanel } from "./move-booking-panel"

type View = "upcoming" | "past"

// The home page: today's counts (each opens Analytics), then the business's
// bookings by day (upcoming first, past one tab away). Each
// opens its details; before it starts it can be moved or cancelled, once it
// has started it can be marked done or no-show.
export function BookingsView({
  businessId,
  upcoming,
  past,
  counts,
  nextDays,
  addOptions,
  createBooking,
  moveBooking,
}: {
  businessId: string
  upcoming: OwnerBooking[]
  past: OwnerBooking[]
  counts: { today: number; upcoming: number }
  nextDays: Array<{ date: string; bookings: number }>
  addOptions: AddBookingOptions
  createBooking: (input: OwnerBookingInput) => Promise<OwnerBookingResult>
  moveBooking: (input: OwnerMoveInput) => Promise<OwnerMoveResult>
}) {
  const [view, setView] = useState<View>("upcoming")
  const [opened, setOpened] = useState<OwnerBooking | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // When the details opened: a booking that has started by then can be
  // marked done or no-show.
  const [openedAt, setOpenedAt] = useState(0)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState(false)
  const [cancelling, setCancelling] = useState<OwnerBooking | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const m = useOwnerMessages()
  const t = m.bookings
  const views = [
    { id: "upcoming" as const, label: t.views.upcoming },
    { id: "past" as const, label: t.views.past },
  ]
  const list = view === "upcoming" ? upcoming : past
  const days = groupByDay(list)
  // Each count opens the Analytics page for more.
  const analytics = `/dashboard/${businessId}/analytics`
  // The table's Team column, only for a business with a team.
  const hasTeam = addOptions.team.length > 0
  const open = (booking: OwnerBooking) => {
    setOpened(booking)
    setOpenedAt(Date.now())
    setDetailsOpen(true)
  }

  const run = (task: () => Promise<{ ok: boolean }>, done: string) =>
    startTransition(async () => {
      const result = await task().catch(() => ({ ok: false }))
      setCancelling(null)
      if (result.ok) {
        setDetailsOpen(false)
        toast.success(done)
        router.refresh()
      } else {
        toast.error(t.failed)
      }
    })

  const started = opened ? Date.parse(opened.startAt) <= openedAt : false
  const footer = opened && (
    <BookingActions
      booking={opened}
      started={started}
      pending={pending}
      onMove={() => {
        setDetailsOpen(false)
        setMoving(true)
      }}
      onCancel={() => setCancelling(opened)}
      onStatus={(status, done) =>
        run(() => setBookingStatus(businessId, opened.id, status), done)
      }
    />
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
          onClick={() => setAdding(true)}
          disabled={addOptions.services.length === 0}
        >
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>
      <StatCards
        stats={[
          { label: t.stats.today, value: counts.today, href: analytics },
          {
            label: t.stats.tomorrow,
            value: nextDays[1]?.bookings ?? 0,
            href: analytics,
          },
          {
            label: t.stats.week,
            value: nextDays
              .slice(0, 7)
              .reduce((sum, day) => sum + day.bookings, 0),
            href: analytics,
          },
          { label: t.stats.upcoming, value: counts.upcoming, href: analytics },
        ]}
        locale={m.locale}
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
            {view === "upcoming" && addOptions.services.length > 0 && (
              // On a phone the floating Add does this.
              <EmptyContent className="max-md:hidden">
                <Button onClick={() => setAdding(true)}>
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
                          <button type="button" onClick={() => open(booking)} />
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
                        onClick={() => open(booking)}
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
                              open(booking)
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
          </>
        )}
      </div>

      <FloatingActionButton
        label={t.addBooking}
        onClick={() => setAdding(true)}
        disabled={addOptions.services.length === 0}
      >
        <PlusIcon />
      </FloatingActionButton>

      <ResponsivePanel
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={opened ? opened.customerName : t.booking}
        footer={footer}
      >
        {opened && <BookingDetails booking={opened} />}
      </ResponsivePanel>

      <AddBookingPanel
        open={adding}
        onClose={() => setAdding(false)}
        businessId={businessId}
        options={addOptions}
        createBooking={createBooking}
      />

      <MoveBookingPanel
        booking={opened}
        open={moving}
        onClose={() => setMoving(false)}
        onMoved={() => setMoving(false)}
        businessId={businessId}
        today={addOptions.today}
        moveBooking={moveBooking}
      />

      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setCancelling(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.cancel.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling &&
                t.cancel.description(
                  cancelling.customerName,
                  formatDay(cancelling.date, m.locale),
                  formatClock(cancelling.time, m.locale)
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t.cancel.keep}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                cancelling &&
                run(
                  () => cancelBooking(businessId, cancelling.id),
                  t.cancel.done
                )
              }
            >
              {t.cancel.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// What can be done with a booking: before it starts, move or cancel it;
// once it has started, mark it done or no-show; after that, undo.
function BookingActions({
  booking,
  started,
  pending,
  onMove,
  onCancel,
  onStatus,
}: {
  booking: OwnerBooking
  started: boolean
  pending: boolean
  onMove: () => void
  onCancel: () => void
  onStatus: (
    status: "confirmed" | "completed" | "no_show",
    done: string
  ) => void
}) {
  const t = useOwnerMessages().bookings
  if (booking.status === "cancelled") return null
  if (booking.status !== "confirmed") {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => onStatus("confirmed", t.actions.undone)}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {t.actions.undo}
      </Button>
    )
  }
  if (!started) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          {t.cancel.confirm}
        </Button>
        <Button disabled={pending} onClick={onMove}>
          {t.move.open}
        </Button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => onStatus("no_show", t.actions.markedNoShow)}
      >
        {t.actions.noShow}
      </Button>
      <Button
        disabled={pending}
        onClick={() => onStatus("completed", t.actions.markedDone)}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {t.actions.done}
      </Button>
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
