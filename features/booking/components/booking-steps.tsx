"use client"

import { Fragment, useEffect, useState } from "react"
import { CalendarX2Icon, StoreIcon, UsersIcon } from "@/components/ui/icons"

import { InfoTip } from "@/components/info-tip"
import { PolicyPointIcon } from "@/components/policy-point-icon"
import { useMessages } from "@/components/language-provider"
import { TimePicker } from "@/components/time-picker"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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
import { PhoneInput } from "@/components/phone-input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { formatClock, formatDay, todayIn } from "@/lib/format-booking-time"
import type { Messages } from "@/lib/i18n"
import { initials } from "@/lib/initials"
import type { Availability } from "../types"
import {
  bookingTotals,
  type BookingAddonGroup,
  type BookingPolicies,
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
    ...team.map((member) => ({ ...member, detail: member.description })),
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

  return (
    <TimePicker
      days={availability.days}
      date={date}
      onDateChange={(next) => {
        setPicked(next)
        onChange(null)
      }}
      time={slot?.date === date ? slot.time : null}
      onTimeChange={(time) => onChange({ date, time })}
      today={todayIn(page.timeZone)}
      locale={m.locale}
      labels={m.booking}
    />
  )
}

export type DetailsError = "name" | "phone" | null

export type BookingDetails = { name: string; phone: string }

// Last step: a name and a phone, nothing else. The flow holds them, so its
// Confirm button knows when both are filled.
export function DetailsStep({
  formId,
  sending,
  error,
  whatsappFrom,
  details,
  onDetailsChange,
  onSubmit,
}: {
  formId: string
  sending: boolean
  error: DetailsError
  // The business's name when it sends WhatsApp booking messages: the ⓘ on
  // Phone says so (Meta opt-in), and booking is the customer's yes.
  whatsappFrom: string | null
  details: BookingDetails
  onDetailsChange: (details: BookingDetails) => void
  onSubmit: (details: BookingDetails) => void
}) {
  const m = useMessages()
  const { name, phone } = details
  const setName = (next: string) => onDetailsChange({ name: next, phone })
  const setPhone = (next: string) => onDetailsChange({ name, phone: next })
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
          <div className="flex items-center gap-1">
            <FieldLabel htmlFor="booking-phone">{m.booking.phone}</FieldLabel>
            {whatsappFrom && (
              <InfoTip label={m.booking.whatsappAbout}>
                {m.booking.whatsappNotice(whatsappFrom)}
              </InfoTip>
            )}
          </div>
          <PhoneInput
            {...noAutofill("booking_phone")}
            id="booking-phone"
            value={phone}
            onChange={setPhone}
            disabled={sending}
            maxLength={25}
            aria-invalid={error === "phone" || undefined}
            locale={m.locale}
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
  member,
  slot,
  footer,
  className,
}: {
  page: BookingPage
  service: BookingService | null
  groups: BookingAddonGroup[]
  addonIds: string[]
  member: { name: string; photoUrl: string | null } | null
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
      {/* Like a Wallet pass: the shop's icon and name on top, then when, big. */}
      <CardHeader className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback>
            <StoreIcon className="size-5" />
          </AvatarFallback>
        </Avatar>
        <CardTitle className="min-w-0 truncate">{page.name}</CardTitle>
      </CardHeader>
      {(service || slot) && (
        <CardContent className="flex flex-col gap-4 text-sm">
          {slot && (
            <div className="flex flex-col gap-0.5">
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatClock(slot.time, m.locale)}
              </p>
              <p className="text-muted-foreground">
                {formatDay(slot.date, m.locale)}
              </p>
            </div>
          )}
          {service && totals && (
            // Rows split by thin lines, like a list in the iPhone's Settings.
            <ItemGroup className="gap-0">
              <Item size="xs" className="px-0">
                {member && (
                  <ItemMedia>
                    <Avatar>
                      {member.photoUrl && (
                        <AvatarImage src={member.photoUrl} alt="" />
                      )}
                      <AvatarFallback>{initials(member.name)}</AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                )}
                <ItemContent className="min-w-0">
                  <ItemTitle>{service.name}</ItemTitle>
                  <ItemDescription>
                    {formatDuration(totals.durationMinutes)}
                    {member && ` · ${m.booking.with(member.name)}`}
                  </ItemDescription>
                </ItemContent>
                {servicePrice && (
                  <ItemActions className="tabular-nums">
                    {servicePrice}
                  </ItemActions>
                )}
              </Item>
              {totals.extras.map((extra) => {
                const price = priceLabel(extra.priceMinor, page.currency, m)
                return (
                  <Fragment key={extra.id}>
                    <ItemSeparator className="my-0" />
                    <Item size="xs" className="px-0">
                      <ItemContent className="min-w-0">
                        <ItemTitle className="font-normal">
                          + {extra.name}
                        </ItemTitle>
                      </ItemContent>
                      {price && (
                        <ItemActions className="text-muted-foreground tabular-nums">
                          {price}
                        </ItemActions>
                      )}
                    </Item>
                  </Fragment>
                )
              })}
              {total && (
                <>
                  <ItemSeparator className="my-0" />
                  <Item size="xs" className="px-0">
                    <ItemContent>
                      <ItemTitle className="font-semibold">
                        {m.booking.total}
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-semibold tabular-nums">
                      {total}
                    </ItemActions>
                  </Item>
                </>
              )}
            </ItemGroup>
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

// The last step: the business's key points as cards, then one box that
// agrees to them and to its policies (each a link, opened in a new tab so
// the booking stays as it is). Confirm waits for the box.
export function PoliciesStep({
  slug,
  policies,
  agreed,
  onAgreedChange,
  sending,
}: {
  slug: string
  policies: BookingPolicies
  agreed: boolean
  onAgreedChange: (agreed: boolean) => void
  sending: boolean
}) {
  const m = useMessages()
  const language = m.locale.startsWith("es") ? "es" : "en"
  const links = policies.documents.map((kind) => (
    <span key={kind}>
      {m.policies.articles[kind]}{" "}
      <a
        href={`/b/${slug}/policies/${kind}?lang=${language}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {m.policies[kind]}
      </a>
    </span>
  ))
  // "the A, the B and the C", joined the language's own way.
  const sentence =
    links.length > 0
      ? new Intl.ListFormat(m.locale, { type: "conjunction" })
          .formatToParts(links.map((_, index) => String(index)))
          .map((part) =>
            part.type === "element" ? links[Number(part.value)] : part.value
          )
      : null

  return (
    <div className="flex flex-col gap-4">
      {policies.points.length > 0 && (
        <ItemGroup className="grid gap-3 sm:grid-cols-2">
          {policies.points.map((point) => (
            <Item key={point.id} variant="muted" className="items-start">
              <ItemMedia variant="icon">
                <PolicyPointIcon icon={point.icon} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="line-clamp-none">{point.title}</ItemTitle>
                <ItemDescription className="line-clamp-none">
                  {point.body}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <FieldLabel htmlFor="booking-agree">
        <Field orientation="horizontal">
          <Checkbox
            id="booking-agree"
            checked={agreed}
            disabled={sending}
            onCheckedChange={(on) => onAgreedChange(on === true)}
          />
          <FieldContent>
            <FieldTitle className="block font-normal">
              {sentence ? (
                <>
                  {m.booking.agreeTo} {sentence}
                </>
              ) : (
                m.booking.agreeToThese
              )}
            </FieldTitle>
          </FieldContent>
        </Field>
      </FieldLabel>
    </div>
  )
}
