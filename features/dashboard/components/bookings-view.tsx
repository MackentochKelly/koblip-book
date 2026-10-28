"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarDaysIcon, ChevronRightIcon, PlusIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
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
import {
  Empty,
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
import { formatClock, formatDay } from "@/lib/format-booking-time"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
} from "@/types/owner-booking"
import { cancelBooking } from "../api/actions"
import { setBookingStatus } from "../api/booking-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"
import { AddBookingPanel, type AddBookingOptions } from "./add-booking-panel"
import { BookingDetails } from "./booking-details"
import { BookingStatusBadge } from "./booking-status-badge"
import { BookingsChart } from "./bookings-chart"

type View = "upcoming" | "past"

// The business's bookings, by day: upcoming first, past one tab away. Each
// opens its details; once it has started it can be marked done or no-show.
export function BookingsView({
  businessId,
  upcoming,
  past,
  counts,
  nextDays,
  addOptions,
  createBooking,
}: {
  businessId: string
  upcoming: OwnerBooking[]
  past: OwnerBooking[]
  counts: { today: number; upcoming: number }
  nextDays: Array<{ date: string; bookings: number }>
  addOptions: AddBookingOptions
  createBooking: (input: OwnerBookingInput) => Promise<OwnerBookingResult>
}) {
  const [view, setView] = useState<View>("upcoming")
  const [opened, setOpened] = useState<OwnerBooking | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // When the details opened: a booking that has started by then can be
  // marked done or no-show.
  const [openedAt, setOpenedAt] = useState(0)
  const [adding, setAdding] = useState(false)
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
      onCancel={() => setCancelling(opened)}
      onStatus={(status, done) =>
        run(() => setBookingStatus(businessId, opened.id, status), done)
      }
    />
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.summary(counts.today, counts.upcoming)}
          </p>
        </div>
        <Button
          onClick={() => setAdding(true)}
          disabled={addOptions.services.length === 0}
        >
          <PlusIcon data-icon="inline-start" />
          {t.add}
        </Button>
      </div>
      <BookingsChart days={nextDays} />
      <ViewTabs
        views={views}
        value={view}
        onChange={setView}
        ariaLabel={t.title}
        listClassName="w-full"
      />
      {days.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDaysIcon />
            </EmptyMedia>
            <EmptyTitle>
              {view === "upcoming" ? t.noUpcoming : t.noPast}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        days.map(([date, bookings]) => (
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
                      onClick={() => {
                        setOpened(booking)
                        setOpenedAt(Date.now())
                        setDetailsOpen(true)
                      }}
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
                      {booking.teamMemberName && ` · ${booking.teamMemberName}`}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRightIcon />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </section>
        ))
      )}

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

// What can be done with a booking: before it starts, cancel it; once it
// has started, mark it done or no-show; after that, undo.
function BookingActions({
  booking,
  started,
  pending,
  onCancel,
  onStatus,
}: {
  booking: OwnerBooking
  started: boolean
  pending: boolean
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
      <Button variant="outline" disabled={pending} onClick={onCancel}>
        {t.cancel.confirm}
      </Button>
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
