"use client"

import { useEffect, useState } from "react"
import { CalendarIcon, CalendarX2Icon, UsersIcon } from "@/components/ui/icons"
import { es } from "react-day-picker/locale"

import { useMessages } from "@/components/language-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import {
  addDaysTo,
  dateFromDay,
  dayFromDate,
  dayOfMonth,
  formatClock,
  formatDay,
  formatWeekdayShort,
  todayIn,
} from "@/lib/format-booking-time"
import type { Messages } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import type { Availability } from "../types"
import {
  bookingTotals,
  type BookingAddonGroup,
  type BookingMember,
  type BookingPage,
  type BookingService,
  type BookingSlot,
} from "./booking-page"
import { noAutofill } from "@/lib/no-autofill"

export const ANYONE = "any"

export function priceLabel(
  priceMinor: number | null,
  currency: string,
  m: Messages
) {
  if (priceMinor === null) return null
  return priceMinor === 0
    ? m.booking.free
    : formatPrice(priceMinor, currency, m.locale)
}

// Step 1: the services as choice cards (shadcn's RadioGroup + Field).
export function ServiceStep({
  page,
  value,
  onChange,
}: {
  page: BookingPage
  value: string
  onChange: (id: string) => void
}) {
  const m = useMessages()
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(String(next))}
      aria-label={m.booking.titles.service}
    >
      {page.services.map((service) => {
        const price = priceLabel(service.priceMinor, page.currency, m)
        return (
          <FieldLabel key={service.id} htmlFor={`service-${service.id}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{service.name}</FieldTitle>
                <FieldDescription>
                  {formatDuration(service.durationMinutes)}
                  {price && ` · ${price}`}
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem value={service.id} id={`service-${service.id}`} />
            </Field>
          </FieldLabel>
        )
      })}
    </RadioGroup>
  )
}

// A group's rule, under its question: optional, pick one, up to three…
function groupHint(group: BookingAddonGroup, m: Messages): string {
  if (group.minSelect > 0) return m.booking.extrasRequired(group.minSelect)
  if (group.maxSelect !== null && group.maxSelect < group.options.length) {
    return m.booking.extrasUpTo(group.maxSelect)
  }
  return m.booking.optional
}

// The extras of the chosen service (like Fresha's add-ons): each group's
// question, then its options as tick cards with what they add.
export function ExtrasStep({
  page,
  groups,
  value,
  onChange,
}: {
  page: BookingPage
  groups: BookingAddonGroup[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const m = useMessages()
  // Kept in page order: group by group, option by option.
  const order = groups.flatMap((group) =>
    group.options.map((option) => option.id)
  )
  const toggle = (group: BookingAddonGroup, id: string, on: boolean) => {
    let next = on ? [...value, id] : value.filter((item) => item !== id)
    // A group that allows one: picking another swaps it.
    if (on && group.maxSelect === 1) {
      const others = group.options
        .map((option) => option.id)
        .filter((item) => item !== id)
      next = next.filter((item) => !others.includes(item))
    }
    onChange(order.filter((item) => next.includes(item)))
  }
  return (
    <FieldGroup>
      {groups.map((group) => {
        const picked = group.options.filter((option) =>
          value.includes(option.id)
        ).length
        const full =
          group.maxSelect !== null &&
          group.maxSelect > 1 &&
          picked >= group.maxSelect
        return (
          <FieldSet key={group.id}>
            <FieldLegend>{group.prompt}</FieldLegend>
            <FieldDescription>{groupHint(group, m)}</FieldDescription>
            <FieldGroup data-slot="checkbox-group" className="gap-3">
              {group.options.map((option) => {
                const checked = value.includes(option.id)
                const price = priceLabel(option.priceMinor, page.currency, m)
                const extra = [
                  option.durationMinutes > 0 &&
                    `+${formatDuration(option.durationMinutes)}`,
                  price && option.priceMinor !== 0 && `+${price}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <FieldLabel key={option.id} htmlFor={`extra-${option.id}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{option.name}</FieldTitle>
                        {option.description && (
                          <FieldDescription>
                            {option.description}
                          </FieldDescription>
                        )}
                        {extra && <FieldDescription>{extra}</FieldDescription>}
                      </FieldContent>
                      <Checkbox
                        id={`extra-${option.id}`}
                        checked={checked}
                        disabled={!checked && full}
                        onCheckedChange={(on) => toggle(group, option.id, on)}
                      />
                    </Field>
                  </FieldLabel>
                )
              })}
            </FieldGroup>
          </FieldSet>
        )
      })}
    </FieldGroup>
  )
}

// Who serves the visitor, only asked when the team has a choice.
export function MemberStep({
  team,
  value,
  onChange,
}: {
  team: BookingMember[]
  value: string
  onChange: (id: string) => void
}) {
  const m = useMessages()
  const options = [
    {
      id: ANYONE,
      name: m.booking.anyone,
      detail: m.booking.whoeverFree,
      photoUrl: null,
    },
    ...team.map((member) => ({ ...member, detail: null })),
  ]
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(String(next))}
      aria-label={m.booking.titles.member}
    >
      {options.map((option) => (
        <FieldLabel key={option.id} htmlFor={`member-${option.id}`}>
          <Field orientation="horizontal">
            <Avatar size="lg">
              {option.photoUrl && <AvatarImage src={option.photoUrl} alt="" />}
              <AvatarFallback>
                {option.id === ANYONE ? <UsersIcon /> : initials(option.name)}
              </AvatarFallback>
            </Avatar>
            <FieldContent>
              <FieldTitle>{option.name}</FieldTitle>
              {option.detail && (
                <FieldDescription>{option.detail}</FieldDescription>
              )}
            </FieldContent>
            <RadioGroupItem value={option.id} id={`member-${option.id}`} />
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  )
}

// Parts of the day the free times are grouped under (until that hour).
const DAY_PARTS = [
  { key: "morning", until: 12 },
  { key: "afternoon", until: 17 },
  { key: "evening", until: 24 },
] as const

// A sideways row of days with the month one tap away, then that day's free
// times grouped into morning, afternoon and evening.
export function TimeStep({
  page,
  serviceId,
  memberId,
  addonIds,
  slot,
  onChange,
}: {
  page: BookingPage
  serviceId: string
  memberId: string | null
  addonIds: string[]
  slot: BookingSlot | null
  onChange: (slot: BookingSlot | null) => void
}) {
  const m = useMessages()
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState<string | null>(slot?.date ?? null)
  const [monthOpen, setMonthOpen] = useState(false)
  const addons = addonIds.join(",")

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ serviceId })
    if (memberId) query.set("teamMemberId", memberId)
    if (addons) query.set("addons", addons)
    fetch(`/api/b/${page.slug}/availability?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<Availability>
      })
      .then((loaded) => {
        setFailed(false)
        setAvailability(loaded)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [page.slug, serviceId, memberId, addons, attempt])

  if (failed) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{m.booking.timesFailed}</EmptyTitle>
        </EmptyHeader>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
        >
          {m.booking.tryAgain}
        </Button>
      </Empty>
    )
  }
  if (!availability) return <Skeleton className="h-80" />

  const free = availability.days.filter((day) => day.times.length > 0)
  if (free.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon />
          </EmptyMedia>
          <EmptyTitle>{m.booking.noTimes}</EmptyTitle>
          {page.phone && <EmptyDescription>{page.phone}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    )
  }

  const freeDays = new Set(free.map((day) => day.date))
  const date = picked && freeDays.has(picked) ? picked : free[0].date
  const times = availability.days.find((day) => day.date === date)?.times ?? []
  const today = todayIn(page.timeZone)
  const tomorrow = addDaysTo(today, 1)
  const first = availability.days[0].date
  const last = availability.days[availability.days.length - 1].date
  const pick = (next: string) => {
    if (next === date) return
    setPicked(next)
    onChange(null)
  }
  const groups = DAY_PARTS.map((part, index) => ({
    label: m.booking[part.key],
    times: times.filter((time) => {
      const hour = Number(time.slice(0, 2))
      return (
        hour < part.until && (index === 0 || hour >= DAY_PARTS[index - 1].until)
      )
    }),
  })).filter((group) => group.times.length > 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-stretch gap-2">
        <div className="no-scrollbar min-w-0 flex-1 scroll-fade-x overflow-x-auto">
          <ToggleGroup
            variant="outline"
            aria-label={m.booking.day}
            value={[date]}
            onValueChange={(value) => {
              if (value[0]) pick(value[0])
            }}
          >
            {availability.days.map((day) => (
              <ToggleGroupItem
                key={day.date}
                value={day.date}
                aria-label={formatDay(day.date, m.locale)}
                disabled={!freeDays.has(day.date)}
                className="h-auto min-w-16 flex-col gap-0 py-2"
              >
                <span className="text-xs font-normal">
                  {day.date === today
                    ? m.booking.today
                    : day.date === tomorrow
                      ? m.booking.tomorrow
                      : formatWeekdayShort(day.date, m.locale)}
                </span>
                <span className="text-base font-semibold">
                  {dayOfMonth(day.date)}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Popover open={monthOpen} onOpenChange={setMonthOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="secondary"
                size="icon-lg"
                aria-label={m.booking.moreDates}
                className="h-auto self-stretch"
              />
            }
          >
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <Calendar
              mode="single"
              required
              locale={m.locale.startsWith("es") ? es : undefined}
              selected={dateFromDay(date)}
              onSelect={(value) => {
                pick(dayFromDate(value))
                setMonthOpen(false)
              }}
              defaultMonth={dateFromDay(date)}
              startMonth={dateFromDay(first)}
              endMonth={dateFromDay(last)}
              disabled={(value) => !freeDays.has(dayFromDate(value))}
              showOutsideDays={false}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-sm font-medium">{formatDay(date, m.locale)}</p>
      {groups.map((group) => (
        <section
          key={group.label}
          aria-label={group.label}
          className="flex flex-col gap-2"
        >
          <h3 className="text-sm text-muted-foreground">{group.label}</h3>
          <ToggleGroup
            variant="outline"
            aria-label={m.booking.timesOf(group.label)}
            value={slot?.date === date ? [slot.time] : []}
            onValueChange={(value) => {
              if (value[0]) onChange({ date, time: value[0] })
            }}
            className="grid w-full grid-cols-3 sm:grid-cols-4"
          >
            {group.times.map((time) => (
              <ToggleGroupItem key={time} value={time}>
                {formatClock(time, m.locale)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      ))}
    </div>
  )
}

export type DetailsError = "name" | "phone" | null

// Last step: a name and a phone, nothing else.
export function DetailsStep({
  formId,
  sending,
  error,
  onSubmit,
}: {
  formId: string
  sending: boolean
  error: DetailsError
  onSubmit: (details: { name: string; phone: string }) => void
}) {
  const m = useMessages()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ name: name.trim(), phone: phone.trim() })
      }}
    >
      <FieldGroup>
        <Field data-invalid={error === "name" || undefined}>
          <FieldLabel htmlFor="booking-name">{m.booking.name}</FieldLabel>
          <Input
            {...noAutofill("booking_name")}
            id="booking-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={sending}
            maxLength={BOOKING_RULES.maxCustomerName}
            aria-invalid={error === "name" || undefined}
          />
          {error === "name" && <FieldError>{m.booking.addName}</FieldError>}
        </Field>
        <Field data-invalid={error === "phone" || undefined}>
          <FieldLabel htmlFor="booking-phone">{m.booking.phone}</FieldLabel>
          <Input
            {...noAutofill("booking_phone")}
            id="booking-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={sending}
            maxLength={25}
            aria-invalid={error === "phone" || undefined}
          />
          {error === "phone" && <FieldError>{m.booking.checkPhone}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  )
}

// What is being booked so far, like Fresha's side card.
export function BookingSummary({
  page,
  service,
  groups,
  addonIds,
  memberName,
  slot,
  footer,
  className,
}: {
  page: BookingPage
  service: BookingService | null
  groups: BookingAddonGroup[]
  addonIds: string[]
  memberName: string | null
  slot: BookingSlot | null
  footer?: React.ReactNode
  className?: string
}) {
  const m = useMessages()
  const totals = service ? bookingTotals(service, groups, addonIds) : null
  const servicePrice = service
    ? priceLabel(service.priceMinor, page.currency, m)
    : null
  const total = totals ? priceLabel(totals.priceMinor, page.currency, m) : null
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{page.name}</CardTitle>
      </CardHeader>
      {(service || slot) && (
        <CardContent className="flex flex-col gap-3 text-sm">
          {slot && (
            <p>
              {formatDay(slot.date, m.locale)} ·{" "}
              {formatClock(slot.time, m.locale)}
            </p>
          )}
          {service && totals && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{service.name}</p>
                  <p className="text-muted-foreground">
                    {formatDuration(totals.durationMinutes)}
                    {memberName && ` · ${m.booking.with(memberName)}`}
                  </p>
                </div>
                {servicePrice && <p>{servicePrice}</p>}
              </div>
              {totals.extras.map((extra) => {
                const price = priceLabel(extra.priceMinor, page.currency, m)
                return (
                  <div
                    key={extra.id}
                    className="flex justify-between gap-3 text-muted-foreground"
                  >
                    <span className="min-w-0">+ {extra.name}</span>
                    {price && <span>{price}</span>}
                  </div>
                )
              })}
            </div>
          )}
          {total && (
            <>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{m.booking.total}</span>
                <span>{total}</span>
              </div>
            </>
          )}
        </CardContent>
      )}
      {footer && (
        <CardFooter className="flex-col items-stretch">{footer}</CardFooter>
      )}
    </Card>
  )
}

// The phone bar's left side: the chosen service, its length and price,
// with the extras added in.
export function BookingTotal({
  page,
  service,
  groups,
  addonIds,
}: {
  page: BookingPage
  service: BookingService | null
  groups: BookingAddonGroup[]
  addonIds: string[]
}) {
  const m = useMessages()
  if (!service) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.booking.titles.service}
      </p>
    )
  }
  const totals = bookingTotals(service, groups, addonIds)
  const price = priceLabel(totals.priceMinor, page.currency, m)
  return (
    <div className="min-w-0 text-sm">
      <p className="truncate font-semibold">{service.name}</p>
      <p className="truncate text-muted-foreground">
        {formatDuration(totals.durationMinutes)}
        {price && ` · ${price}`}
      </p>
    </div>
  )
}
