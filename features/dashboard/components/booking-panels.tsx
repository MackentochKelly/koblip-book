"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
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
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CANCEL_REASONS, type CancelReason } from "@/lib/booking-rules"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { TOUCH_AREA } from "@/lib/touch-area"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
  OwnerFreeTimes,
  OwnerFreeTimesInput,
  OwnerMoveFreeTimesInput,
  OwnerMoveInput,
  OwnerMoveResult,
} from "@/types/owner-booking"
import { cancelBooking } from "../api/actions"
import { setBookingStatus } from "../api/booking-actions"
import { setBookingPaid } from "../api/payment-actions"
import type { OwnerBooking } from "../types"
import { type BookingAction, bookingActions } from "../utils/booking-filters"
import { AddBookingPanel, type AddBookingOptions } from "./add-booking-panel"
import { BookingDetails } from "./booking-details"
import { MoveBookingPanel } from "./move-booking-panel"

export interface BookingPanelsProps {
  businessId: string
  addOptions: AddBookingOptions
  createBooking: (input: OwnerBookingInput) => Promise<OwnerBookingResult>
  findFreeTimes: (input: OwnerFreeTimesInput) => Promise<OwnerFreeTimes>
  moveBooking: (input: OwnerMoveInput) => Promise<OwnerMoveResult>
  findMoveFreeTimes: (input: OwnerMoveFreeTimesInput) => Promise<OwnerFreeTimes>
}

// Everything a booking can open, shared by Home and the Bookings page: its
// details, adding one, moving one, the cancel question, and marking it
// done or no-show. Render `panels` once; call the rest from rows and menus.
export function useBookingPanels({
  businessId,
  addOptions,
  createBooking,
  findFreeTimes,
  moveBooking,
  findMoveFreeTimes,
}: BookingPanelsProps) {
  const [opened, setOpened] = useState<OwnerBooking | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // When the details opened, read in the tap handler: a booking that has
  // started by then can be marked done or no-show.
  const [openedAt, setOpenedAt] = useState("")
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState(false)
  const [cancelling, setCancelling] = useState<OwnerBooking | null>(null)
  // The quick answer to "Why?", picked in the cancel question (optional).
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const t = useTranslations("owner.bookings")
  const locale = useLocale()

  const run = (task: () => Promise<{ ok: boolean }>, done: string) =>
    startTransition(async () => {
      const result = await task().catch(() => ({ ok: false }))
      setCancelling(null)
      if (result.ok) {
        setDetailsOpen(false)
        toast.success(done)
        router.refresh()
      } else {
        toast.error(t("failed"))
      }
    })

  // `at` is when the owner tapped (ms), read in the tap handler itself.
  const open = (booking: OwnerBooking, at: number) => {
    setOpened(booking)
    setOpenedAt(new Date(at).toISOString())
    setDetailsOpen(true)
  }

  // One action, from the details' footer or a row's menu.
  const act = (booking: OwnerBooking, action: BookingAction) => {
    if (action === "move") {
      setOpened(booking)
      setDetailsOpen(false)
      setMoving(true)
    } else if (action === "cancel") {
      setReason(null)
      setCancelling(booking)
    } else if (action === "undo") {
      run(
        () => setBookingStatus(businessId, booking.id, "confirmed"),
        t("actions.undone")
      )
    } else if (action === "done") {
      run(
        () => setBookingStatus(businessId, booking.id, "completed"),
        t("actions.markedDone")
      )
    } else {
      run(
        () => setBookingStatus(businessId, booking.id, "no_show"),
        t("actions.markedNoShow")
      )
    }
  }

  const actions = opened ? bookingActions(opened, openedAt) : []
  // Two side by side: the quieter one first, the main one last.
  const footer = actions.length > 0 && opened && (
    <div className={actions.length > 1 ? "grid grid-cols-2 gap-2" : "grid"}>
      {[...actions].reverse().map((action, index) => (
        <Button
          key={action}
          variant={
            index === actions.length - 1 && actions.length > 1
              ? "default"
              : "outline"
          }
          disabled={pending}
          onClick={() => act(opened, action)}
        >
          {pending && index === actions.length - 1 && (
            <Spinner data-icon="inline-start" />
          )}
          {t(ACTION_LABELS[action])}
        </Button>
      ))}
    </div>
  )

  const panels = (
    <>
      <ResponsivePanel
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={opened ? opened.customerName : t("booking")}
        footer={footer}
      >
        {opened && (
          <BookingDetails
            booking={opened}
            pending={pending}
            onPaid={(paid) =>
              run(
                () => setBookingPaid(businessId, opened.id, paid),
                t(paid ? "payment.markedPaid" : "payment.markedUnpaid")
              )
            }
          />
        )}
      </ResponsivePanel>

      <AddBookingPanel
        open={adding}
        onClose={() => setAdding(false)}
        businessId={businessId}
        options={addOptions}
        createBooking={createBooking}
        findFreeTimes={findFreeTimes}
      />

      <MoveBookingPanel
        booking={opened}
        open={moving}
        onClose={() => setMoving(false)}
        onMoved={() => setMoving(false)}
        businessId={businessId}
        today={addOptions.today}
        moveBooking={moveBooking}
        findFreeTimes={findMoveFreeTimes}
      />

      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setCancelling(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancel.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling &&
                t("cancel.description", {
                  name: cancelling.customerName,
                  day: formatDay(cancelling.date, locale),
                  time: formatClock(cancelling.time, locale),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <p id="cancel-why" className="text-sm font-medium">
              {t("cancel.why")}
            </p>
            <ToggleGroup
              variant="outline"
              aria-labelledby="cancel-why"
              className="flex-wrap"
              value={reason ? [reason] : []}
              onValueChange={(next) =>
                setReason(
                  CANCEL_REASONS.find((item) => item === next[0]) ?? null
                )
              }
            >
              {CANCEL_REASONS.map((item) => (
                <ToggleGroupItem
                  key={item}
                  value={item}
                  disabled={pending}
                  className={TOUCH_AREA}
                >
                  {t(`cancel.reasons.${item}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel.keep")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                cancelling &&
                run(
                  () => cancelBooking(businessId, cancelling.id, reason),
                  t("cancel.done")
                )
              }
            >
              {t("cancel.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  return {
    open,
    add: () => setAdding(true),
    canAdd: addOptions.services.length > 0,
    act,
    pending,
    panels,
  }
}

// Each action's name, in the owner.bookings words.
export const ACTION_LABELS = {
  move: "move.open",
  cancel: "cancel.confirm",
  done: "actions.done",
  noShow: "actions.noShow",
  undo: "actions.undo",
} as const satisfies Record<BookingAction, string>
