"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
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
import { PhoneInput } from "@/components/phone-input"
import { AppSelect } from "@/components/app-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useFormatDuration } from "@/hooks/use-format-duration"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { addDaysTo } from "@/lib/format-booking-time"
import type {
  OwnerBookingInput,
  OwnerBookingResult,
  OwnerFreeTimes,
  OwnerFreeTimesInput,
} from "@/types/owner-booking"
import { noAutofill } from "@/lib/no-autofill"
import { languageOf } from "@/lib/page-language"
import type { OwnerServiceCategory } from "../types"
import { serviceSelectOptions } from "../utils/service-options"
import { BookingWhen, firstFreeDay, useFreeTimes } from "./booking-when"

const FORM = "add-booking-form"
const ANYONE = "any"

type InvalidField = Extract<OwnerBookingResult, { status: "invalid" }>["field"]

export interface AddBookingOptions {
  services: {
    id: string
    name: string
    durationMinutes: number
    categoryId: string | null
  }[]
  // In their order: the service picker's groups.
  categories: OwnerServiceCategory[]
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
  // The business sends WhatsApp booking messages: ask whether the customer agreed.
  whatsapp: boolean
}

// A booking the owner adds: a walk-in or a phone call. It offers the free
// times first, as the booking page does; Other time opens any day and time,
// and times outside the hours or already taken ask once, then can be booked
// anyway.
export function AddBookingPanel({
  open,
  onClose,
  businessId,
  options,
  createBooking,
  findFreeTimes,
}: {
  open: boolean
  onClose: () => void
  businessId: string
  options: AddBookingOptions
  createBooking: (input: OwnerBookingInput) => Promise<OwnerBookingResult>
  findFreeTimes: (input: OwnerFreeTimesInput) => Promise<OwnerFreeTimes>
}) {
  const router = useRouter()
  const t = useTranslations("owner.bookings.form")
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
        toast.success(t("added"))
        router.refresh()
      } else if (result.status === "conflict") {
        setConflict({ input, reason: result.reason })
      } else if (result.status === "invalid") {
        setConflict(null)
        setInvalid(result.field)
      } else {
        setConflict(null)
        toast.error(t("failed"))
      }
    })

  return (
    <>
      <ResponsivePanel
        open={open}
        onClose={onClose}
        title={t("title")}
        footer={
          <Button type="submit" size="lg" form={FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t("submit")}
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
          findFreeTimes={findFreeTimes}
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
              {conflict?.reason === "closed" ? t("closed") : t("taken")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("bookAnyway")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("changeTime")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                conflict && send({ ...conflict.input, allowConflict: true })
              }
            >
              {t("confirmAnyway")}
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
  findFreeTimes,
}: {
  businessId: string
  options: AddBookingOptions
  invalid: InvalidField | null
  onInvalid: (field: InvalidField | null) => void
  onSubmit: (input: OwnerBookingInput) => void
  findFreeTimes: (input: OwnerFreeTimesInput) => Promise<OwnerFreeTimes>
}) {
  const t = useTranslations("owner.bookings.form")
  const catalog = useTranslations("owner.catalog")
  const locale = useLocale()
  const formatDuration = useFormatDuration()
  const services = serviceSelectOptions(
    options.services,
    options.categories,
    catalog("categories.other"),
    (service) => `${service.name} · ${formatDuration(service.durationMinutes)}`
  )
  // Starts on the list's first service: with categories, the first one's.
  const [serviceId, setServiceId] = useState(services[0]?.value ?? "")
  const [memberId, setMemberId] = useState(ANYONE)
  const [date, setDate] = useState(options.today)
  const [time, setTime] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [addonIds, setAddonIds] = useState<string[]>([])
  // Other time (`anyTime`) shows the plain day and time fields instead.
  const [anyTime, setAnyTime] = useState(false)
  const teamMemberId = memberId === ANYONE ? null : memberId
  const free = useFreeTimes(
    [serviceId, teamMemberId, ...addonIds].join(","),
    () => findFreeTimes({ businessId, serviceId, teamMemberId, addonIds }),
    (found) => {
      // Start on the first day with a free time; the old time may be gone.
      const first = firstFreeDay(found)
      if (first) setDate(first)
      setTime("")
    }
  )
  const groups = options.addonGroups.filter((group) =>
    group.serviceIds.includes(serviceId)
  )

  const allowed = options.serviceTeams[serviceId]
  const members = [
    { value: ANYONE, label: t("anyone") },
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
          teamMemberId,
          addonIds,
          date,
          time,
          name: name.trim(),
          phone: phone.trim() || null,
          note: note.trim() || null,
          allowConflict: false,
          whatsappOptIn: options.whatsapp && !!phone.trim() && whatsappOptIn,
          language: languageOf(locale),
        })
      }}
    >
      <FieldGroup>
        <Field data-invalid={error("service")}>
          <FieldLabel htmlFor="add-service">{t("service")}</FieldLabel>
          <AppSelect
            id="add-service"
            options={services}
            value={serviceId}
            onValueChange={(value) => {
              setServiceId(value)
              setMemberId(ANYONE)
              setAddonIds([])
            }}
            className="w-full"
          />
          {invalid === "service" && (
            <FieldError>{t("pickService")}</FieldError>
          )}
        </Field>
        {options.team.length > 1 && (
          <Field data-invalid={error("teamMember")}>
            <FieldLabel htmlFor="add-member">{t("with")}</FieldLabel>
            <AppSelect
              id="add-member"
              options={members}
              value={memberId}
              onValueChange={setMemberId}
              className="w-full"
            />
            {invalid === "teamMember" && (
              <FieldError>{t("notTheirService")}</FieldError>
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
        {invalid === "addons" && <FieldError>{t("checkExtras")}</FieldError>}
        <BookingWhen
          free={free}
          anyTime={anyTime}
          onAnyTimeChange={setAnyTime}
          date={date}
          onDateChange={setDate}
          time={time}
          onTimeChange={setTime}
          today={options.today}
          error={
            invalid === "time" || invalid === "date" ? t("pickTime") : null
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={error("date")}>
              <FieldLabel htmlFor="add-date">{t("day")}</FieldLabel>
              <DatePicker
                id="add-date"
                value={date}
                min={addDaysTo(options.today, -BOOKING_RULES.ownerDaysBack)}
                max={addDaysTo(options.today, BOOKING_RULES.ownerDaysAhead)}
                onChange={setDate}
                locale={locale}
                invalid={error("date")}
              />
              {invalid === "date" && <FieldError>{t("pickDay")}</FieldError>}
            </Field>
            <Field data-invalid={error("time")}>
              <FieldLabel htmlFor="add-time">{t("time")}</FieldLabel>
              <TimeInput
                id="add-time"
                step={300}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-invalid={error("time")}
              />
              {invalid === "time" && <FieldError>{t("pickTime")}</FieldError>}
            </Field>
          </div>
        </BookingWhen>
        <Field data-invalid={error("name")}>
          <FieldLabel htmlFor="add-name">{t("customer")}</FieldLabel>
          <Input
            {...noAutofill("add_name")}
            id="add-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxCustomerName}
            aria-invalid={error("name")}
          />
          {invalid === "name" && <FieldError>{t("addName")}</FieldError>}
        </Field>
        <Field data-invalid={error("phone")}>
          <FieldLabel htmlFor="add-phone">{t("phone")}</FieldLabel>
          <PhoneInput
            {...noAutofill("add_phone")}
            id="add-phone"
            value={phone}
            onChange={setPhone}
            placeholder={t("optional")}
            aria-invalid={error("phone")}
            locale={locale}
          />
          {invalid === "phone" && <FieldError>{t("checkPhone")}</FieldError>}
        </Field>
        {options.whatsapp && phone.trim() && (
          <Field orientation="horizontal">
            <Checkbox
              id="add-whatsapp"
              checked={whatsappOptIn}
              onCheckedChange={(on) => setWhatsappOptIn(on === true)}
            />
            <FieldLabel htmlFor="add-whatsapp" className="font-normal">
              {t("whatsappOptIn")}
            </FieldLabel>
          </Field>
        )}
        <Field data-invalid={error("note")}>
          <FieldLabel htmlFor="add-note">{t("note")}</FieldLabel>
          <Textarea
            {...noAutofill("add_note")}
            id="add-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={BOOKING_RULES.maxNote}
            placeholder={t("optional")}
          />
        </Field>
      </FieldGroup>
    </form>
  )
}
