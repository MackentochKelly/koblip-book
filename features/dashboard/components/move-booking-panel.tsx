"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { ResponsivePanel } from "@/components/responsive-panel"
import { TimeInput } from "@/components/time-input"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { addDaysTo } from "@/lib/format-booking-time"
import type { OwnerMoveInput, OwnerMoveResult } from "@/types/owner-booking"
import { useOwnerMessages } from "../i18n/provider"
import type { OwnerBooking } from "../types"

const FORM = "move-booking-form"

type InvalidField = Extract<OwnerMoveResult, { status: "invalid" }>["field"]

// The owner moves a booking to another day or time, with the same person
// and length. A closed or taken time asks once, then can be moved anyway.
export function MoveBookingPanel({
  booking,
  open,
  onClose,
  onMoved,
  businessId,
  today,
  moveBooking,
}: {
  booking: OwnerBooking | null
  open: boolean
  onClose: () => void
  onMoved: () => void
  businessId: string
  today: string
  moveBooking: (input: OwnerMoveInput) => Promise<OwnerMoveResult>
}) {
  const router = useRouter()
  const m = useOwnerMessages()
  const t = m.bookings.move
  const form = m.bookings.form
  const [pending, startTransition] = useTransition()
  const [invalid, setInvalid] = useState<InvalidField | null>(null)
  const [conflict, setConflict] = useState<{
    input: OwnerMoveInput
    reason: "closed" | "busy"
  } | null>(null)

  const send = (input: OwnerMoveInput) =>
    startTransition(async () => {
      const result = await moveBooking(input).catch(
        () => ({ status: "failed" }) as const
      )
      if (result.status === "moved") {
        setConflict(null)
        setInvalid(null)
        onMoved()
        toast.success(t.moved)
        router.refresh()
      } else if (result.status === "conflict") {
        setConflict({ input, reason: result.reason })
      } else if (result.status === "invalid") {
        setConflict(null)
        setInvalid(result.field)
      } else {
        setConflict(null)
        toast.error(t.failed)
      }
    })

  return (
    <>
      <ResponsivePanel
        open={open}
        onClose={onClose}
        title={t.title}
        footer={
          <Button type="submit" size="lg" form={FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t.submit}
          </Button>
        }
      >
        {booking && (
          <MoveForm
            key={booking.id}
            booking={booking}
            today={today}
            invalid={invalid}
            onInvalid={setInvalid}
            onSubmit={(date, time) =>
              send({
                businessId,
                bookingId: booking.id,
                date,
                time,
                allowConflict: false,
              })
            }
          />
        )}
      </ResponsivePanel>
      <AlertDialog
        open={conflict !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setConflict(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflict?.reason === "closed" ? form.closed : form.taken}
            </AlertDialogTitle>
            <AlertDialogDescription>{t.moveAnyway}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {form.changeTime}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                conflict && send({ ...conflict.input, allowConflict: true })
              }
            >
              {t.confirmAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function MoveForm({
  booking,
  today,
  invalid,
  onInvalid,
  onSubmit,
}: {
  booking: OwnerBooking
  today: string
  invalid: InvalidField | null
  onInvalid: (field: InvalidField | null) => void
  onSubmit: (date: string, time: string) => void
}) {
  const m = useOwnerMessages()
  const form = m.bookings.form
  const [date, setDate] = useState(booking.date)
  const [time, setTime] = useState(booking.time)
  const error = (field: InvalidField) => invalid === field || undefined

  return (
    <form
      id={FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!date) return onInvalid("date")
        if (!time) return onInvalid("time")
        onInvalid(null)
        onSubmit(date, time)
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={error("date")}>
            <FieldLabel htmlFor="move-date">{form.day}</FieldLabel>
            <DatePicker
              id="move-date"
              value={date}
              min={today}
              max={addDaysTo(today, BOOKING_RULES.ownerDaysAhead)}
              onChange={setDate}
              locale={m.locale}
              invalid={error("date")}
            />
            {invalid === "date" && <FieldError>{form.pickDay}</FieldError>}
          </Field>
          <Field data-invalid={error("time")}>
            <FieldLabel htmlFor="move-time">{form.time}</FieldLabel>
            <TimeInput
              id="move-time"
              step={300}
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-invalid={error("time")}
            />
            {invalid === "time" && (
              <FieldError>{m.bookings.move.later}</FieldError>
            )}
          </Field>
        </div>
      </FieldGroup>
    </form>
  )
}
