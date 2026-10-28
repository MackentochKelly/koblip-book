"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { addDaysTo } from "@/lib/format-booking-time"
import { formatDuration } from "@/lib/format-duration"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
} from "@/types/owner-booking"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerMessages } from "../i18n/provider"

const FORM = "add-booking-form"
const ANYONE = "any"

type InvalidField = Extract<OwnerBookingResult, { status: "invalid" }>["field"]

export interface AddBookingOptions {
  services: { id: string; name: string; durationMinutes: number }[]
  team: { id: string; name: string }[]
  // serviceId → the members who do it; missing = everyone.
  serviceTeams: Record<string, string[]>
  addonGroups: {
    id: string
    prompt: string
    maxSelect: number | null
    serviceIds: string[]
    options: { id: string; name: string }[]
  }[]
  today: string
}

// A booking the owner adds: a walk-in or a phone call. Times outside the
// hours or already taken ask once, then can be booked anyway.
export function AddBookingPanel({
  open,
  onClose,
  businessId,
  options,
  createBooking,
}: {
  open: boolean
  onClose: () => void
  businessId: string
  options: AddBookingOptions
  createBooking: (input: OwnerBookingInput) => Promise<OwnerBookingResult>
}) {
  const router = useRouter()
  const t = useOwnerMessages().bookings.form
  const [pending, startTransition] = useTransition()
  const [formKey, setFormKey] = useState(0)
  const [invalid, setInvalid] = useState<InvalidField | null>(null)
  const [conflict, setConflict] = useState<{
    input: OwnerBookingInput
    reason: "closed" | "busy"
  } | null>(null)

  const send = (input: OwnerBookingInput) =>
    startTransition(async () => {
      const result = await createBooking(input).catch(
        () => ({ status: "failed" }) as const
      )
      if (result.status === "booked") {
        setConflict(null)
        setInvalid(null)
        setFormKey((value) => value + 1)
        onClose()
        toast.success(t.added)
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
        <BookingForm
          key={formKey}
          businessId={businessId}
          options={options}
          invalid={invalid}
          onInvalid={setInvalid}
          onSubmit={send}
        />
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
              {conflict?.reason === "closed" ? t.closed : t.taken}
            </AlertDialogTitle>
            <AlertDialogDescription>{t.bookAnyway}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t.changeTime}
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

function BookingForm({
  businessId,
  options,
  invalid,
  onInvalid,
  onSubmit,
}: {
  businessId: string
  options: AddBookingOptions
  invalid: InvalidField | null
  onInvalid: (field: InvalidField | null) => void
  onSubmit: (input: OwnerBookingInput) => void
}) {
  const t = useOwnerMessages().bookings.form
  const [serviceId, setServiceId] = useState(options.services[0]?.id ?? "")
  const [memberId, setMemberId] = useState(ANYONE)
  const [date, setDate] = useState(options.today)
  const [time, setTime] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [addonIds, setAddonIds] = useState<string[]>([])
  const groups = options.addonGroups.filter((group) =>
    group.serviceIds.includes(serviceId)
  )

  const services = options.services.map((service) => ({
    value: service.id,
    label: `${service.name} · ${formatDuration(service.durationMinutes)}`,
  }))
  const allowed = options.serviceTeams[serviceId]
  const members = [
    { value: ANYONE, label: t.anyone },
    ...options.team
      .filter((member) => !allowed || allowed.includes(member.id))
      .map((member) => ({ value: member.id, label: member.name })),
  ]
  const error = (field: InvalidField) => invalid === field || undefined

  return (
    <form
      id={FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!serviceId) return onInvalid("service")
        if (!date) return onInvalid("date")
        if (!time) return onInvalid("time")
        if (!name.trim()) return onInvalid("name")
        if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
          return onInvalid("phone")
        }
        onInvalid(null)
        onSubmit({
          businessId,
          serviceId,
          teamMemberId: memberId === ANYONE ? null : memberId,
          addonIds,
          date,
          time,
          name: name.trim(),
          phone: phone.trim() || null,
          note: note.trim() || null,
          allowConflict: false,
        })
      }}
    >
      <FieldGroup>
        <Field data-invalid={error("service")}>
          <FieldLabel htmlFor="add-service">{t.service}</FieldLabel>
          <Select
            items={services}
            value={serviceId}
            onValueChange={(value) => {
              if (!value) return
              setServiceId(String(value))
              setMemberId(ANYONE)
              setAddonIds([])
            }}
          >
            <SelectTrigger id="add-service" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {services.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {invalid === "service" && <FieldError>{t.pickService}</FieldError>}
        </Field>
        {options.team.length > 1 && (
          <Field data-invalid={error("teamMember")}>
            <FieldLabel htmlFor="add-member">{t.with}</FieldLabel>
            <Select
              items={members}
              value={memberId}
              onValueChange={(value) => value && setMemberId(String(value))}
            >
              <SelectTrigger id="add-member" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid === "teamMember" && (
              <FieldError>{t.notTheirService}</FieldError>
            )}
          </Field>
        )}
        {groups.map((group) => {
          const picked = group.options.filter((option) =>
            addonIds.includes(option.id)
          ).length
          return (
            <FieldSet key={group.id} data-invalid={error("addons")}>
              <FieldLegend variant="label">{group.prompt}</FieldLegend>
              <FieldGroup data-slot="checkbox-group">
                {group.options.map((option) => {
                  const checked = addonIds.includes(option.id)
                  return (
                    <Field key={option.id} orientation="horizontal">
                      <Checkbox
                        id={`add-extra-${option.id}`}
                        checked={checked}
                        disabled={
                          !checked &&
                          group.maxSelect !== null &&
                          group.maxSelect > 1 &&
                          picked >= group.maxSelect
                        }
                        onCheckedChange={(on) =>
                          setAddonIds((current) => {
                            // A group that allows one: picking another swaps it.
                            const replaced =
                              group.maxSelect === 1
                                ? group.options.map((item) => item.id)
                                : [option.id]
                            const rest = current.filter(
                              (id) => !replaced.includes(id)
                            )
                            return on ? [...rest, option.id] : rest
                          })
                        }
                      />
                      <FieldLabel
                        htmlFor={`add-extra-${option.id}`}
                        className="font-normal"
                      >
                        {option.name}
                      </FieldLabel>
                    </Field>
                  )
                })}
              </FieldGroup>
            </FieldSet>
          )
        })}
        {invalid === "addons" && <FieldError>{t.checkExtras}</FieldError>}
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={error("date")}>
            <FieldLabel htmlFor="add-date">{t.day}</FieldLabel>
            <Input
              id="add-date"
              type="date"
              value={date}
              min={addDaysTo(options.today, -BOOKING_RULES.ownerDaysBack)}
              max={addDaysTo(options.today, BOOKING_RULES.ownerDaysAhead)}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={error("date")}
            />
            {invalid === "date" && <FieldError>{t.pickDay}</FieldError>}
          </Field>
          <Field data-invalid={error("time")}>
            <FieldLabel htmlFor="add-time">{t.time}</FieldLabel>
            <Input
              id="add-time"
              type="time"
              step={300}
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-invalid={error("time")}
            />
            {invalid === "time" && <FieldError>{t.pickTime}</FieldError>}
          </Field>
        </div>
        <Field data-invalid={error("name")}>
          <FieldLabel htmlFor="add-name">{t.customer}</FieldLabel>
          <Input
            {...noAutofill("add_name")}
            id="add-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxCustomerName}
            aria-invalid={error("name")}
          />
          {invalid === "name" && <FieldError>{t.addName}</FieldError>}
        </Field>
        <Field data-invalid={error("phone")}>
          <FieldLabel htmlFor="add-phone">{t.phone}</FieldLabel>
          <Input
            {...noAutofill("add_phone")}
            id="add-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t.optional}
            aria-invalid={error("phone")}
          />
          {invalid === "phone" && (
            <FieldError>{t.checkPhone}</FieldError>
          )}
        </Field>
        <Field data-invalid={error("note")}>
          <FieldLabel htmlFor="add-note">{t.note}</FieldLabel>
          <Textarea
            {...noAutofill("add_note")}
            id="add-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={BOOKING_RULES.maxNote}
            placeholder={t.optional}
          />
        </Field>
      </FieldGroup>
    </form>
  )
}
