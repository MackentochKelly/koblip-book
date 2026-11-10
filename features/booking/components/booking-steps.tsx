"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import {
  CalendarIcon,
  CalendarX2Icon,
  ClockIcon,
  GiftIcon,
  UsersIcon,
} from "@/components/ui/icons"
import { CopyButton } from "@/components/copy-button"
import { PaymentProofField } from "@/components/payment-proof-field"
import { PaymentTypeIcon } from "@/components/payment-type-icon"

import { InfoTip } from "@/components/info-tip"
import { PolicyPointIcon } from "@/components/policy-point-icon"
import { TimePicker } from "@/components/time-picker"
import { ViewTabs } from "@/components/view-tabs"
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
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useElementHeight } from "@/hooks/use-element-height"
import { useFormatDuration } from "@/hooks/use-format-duration"
import { useRewardWords } from "@/hooks/use-reward-words"
import { scrollParent, useScrollSpy } from "@/hooks/use-scroll-spy"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { formatPrice } from "@/lib/format-price"
import { totalWithReward, type HeldReward } from "@/lib/reward-rules"
import { formatClock, formatDay, todayIn } from "@/lib/format-booking-time"
import { initials } from "@/lib/initials"
import { ACCOUNT_ADD_PHONE_PATH } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import { PAYMENT_RULES, type PaymentOptions } from "@/lib/payment-rules"
import { policySegment } from "@/lib/policy-rules"
import { groupServices, showsGroups } from "@/lib/service-groups"
import { cn } from "@/lib/utils"
import { getPaymentDetails } from "../api/payment-details"
import type { MyRewards } from "../api/rewards"
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

// A price as the booking shows it: "Free" for 0, nothing when it has none.
export function usePriceLabel() {
  const t = useTranslations("public.booking")
  const locale = useLocale()
  return (priceMinor: number | null, currency: string) => {
    if (priceMinor === null) return null
    return priceMinor === 0 ? t("free") : formatPrice(priceMinor, currency, locale)
  }
}

// The time picker's words (components/time-picker.tsx), in the page's
// language.
export function useTimeLabels() {
  const t = useTranslations("public.booking")
  return {
    today: t("today"),
    tomorrow: t("tomorrow"),
    day: t("day"),
    moreDates: t("moreDates"),
    morning: t("morning"),
    afternoon: t("afternoon"),
    evening: t("evening"),
    timesOf: (part: string) => t("timesOf", { part }),
  }
}

// How far under the pinned category tabs (px) a group's top counts as
// reached: past where a tab's jump lands it.
const GROUP_REACHED = 32

// The element id of a group of services, which its tab jumps to.
const groupId = (category: { id: string } | null) =>
  `service-group-${category?.id ?? "other"}`

// Step 1: the services as choice cards (shadcn's RadioGroup + Field). With
// service categories (docs/plans/service-categories.md), one titled set of
// cards per group, like the extras; with two or more groups, tabs pinned at
// the top jump to a group and follow the one in view, like the business
// page's section tabs. In the phone's sheet (`mode` "drawer") the sheet's
// list scrolls; on the booking page the page does, under its header.
export function ServiceStep({
  page,
  mode,
  value,
  onChange,
}: {
  page: BookingPage
  mode: "page" | "drawer"
  value: string
  onChange: (id: string) => void
}) {
  const t = useTranslations("public")
  const priceLabel = usePriceLabel()
  const formatDuration = useFormatDuration()
  const groups = groupServices(page.services, page.serviceCategories)
  const grouped = showsGroups(groups)
  const sections =
    grouped && groups.length >= 2
      ? groups.map((group) => ({
          id: groupId(group.category),
          label: group.category?.name ?? t("sections.otherServices"),
        }))
      : []
  const tabbed = sections.length > 0
  const bar = useRef<HTMLDivElement | null>(null)
  const [measureBar, barHeight] = useElementHeight()
  const barRef = useCallback(
    (node: HTMLDivElement | null) => {
      bar.current = node
      const stop = measureBar(node)
      return () => {
        bar.current = null
        stop?.()
      }
    },
    [measureBar]
  )
  const active = useScrollSpy(
    sections.map((section) => section.id),
    {
      line: () =>
        (bar.current?.getBoundingClientRect().bottom ?? 0) + GROUP_REACHED,
      inside: bar,
    }
  )
  // A pressed tab stays marked until the customer scrolls by hand: the last
  // groups of a short list can't scroll up to the tabs, so the scroll alone
  // would mark another one.
  const [pressed, setPressed] = useState<string | null>(null)
  useEffect(() => {
    if (!pressed) return
    const scroller = scrollParent(bar.current) ?? window
    const release = () => setPressed(null)
    const inputs = ["wheel", "touchmove", "keydown"] as const
    for (const type of inputs) {
      scroller.addEventListener(type, release, { passive: true })
    }
    return () => {
      for (const type of inputs) scroller.removeEventListener(type, release)
    }
  }, [pressed])
  const card = (service: BookingService) => {
    const price = priceLabel(service.priceMinor, page.currency)
    return (
      <FieldLabel
        variant="box"
        key={service.id}
        htmlFor={`service-${service.id}`}
      >
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>{service.name}</FieldTitle>
            <FieldDescription>
              {formatDuration(service.durationMinutes)}
              {price && ` · ${price}`}
            </FieldDescription>
          </FieldContent>
          <RadioGroupItem
            value={service.id}
            id={`service-${service.id}`}
            // A focused choice scrolls clear of the pinned tabs.
            className={cn(
              tabbed &&
                "scroll-mt-[calc(var(--pin-top)+var(--tabs-height)+--spacing(6))]"
            )}
          />
        </Field>
      </FieldLabel>
    )
  }

  const list = (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(String(next))}
      aria-label={t("booking.titles.service")}
      className={cn(grouped && "gap-7")}
    >
      {grouped
        ? groups.map((group) => (
            <FieldSet
              key={groupId(group.category)}
              id={groupId(group.category)}
              // Where a group lands when its tab is pressed: just under
              // the pinned tabs.
              className={cn(
                tabbed &&
                  "scroll-mt-[calc(var(--pin-top)+var(--tabs-height)+--spacing(4))]"
              )}
            >
              <FieldLegend>
                {group.category?.name ?? t("sections.otherServices")}
              </FieldLegend>
              <FieldGroup className="gap-3">
                {group.services.map(card)}
              </FieldGroup>
            </FieldSet>
          ))
        : page.services.map(card)}
    </RadioGroup>
  )
  if (!tabbed) return list

  const sheet = mode === "drawer"
  const current =
    sections.find((section) => section.id === pressed)?.id ??
    active ??
    sections[0].id
  return (
    <div
      // --pin-top: where the tabs pin, from the top of what scrolls: the
      // sheet's own edge, or under the booking page's header.
      className={cn(
        "flex flex-col gap-4",
        sheet
          ? "[--pin-top:--spacing(0)]"
          : "[--pin-top:calc(--spacing(14)+var(--safe-top))]"
      )}
      style={
        { "--tabs-height": `${barHeight ?? 0}px` } as React.CSSProperties
      }
    >
      {/* Edge to edge on the sheet's or the page's colour, so the cards
          slide under it. A pinned box stops at its list's padding (the
          sheet's p-4), so -top-4 takes it up to the sheet's edge. */}
      <div
        ref={barRef}
        className={cn(
          "sticky z-10 -mx-4 pt-2",
          sheet ? "-top-4 bg-popover" : "top-(--pin-top) bg-background md:mx-0"
        )}
      >
        <ViewTabs
          variant="line"
          listClassName={sheet ? "px-4" : "px-4 md:px-0"}
          views={sections}
          value={current}
          onChange={(id) => {
            setPressed(id)
            const reduce = window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches
            document.getElementById(id)?.scrollIntoView({
              behavior: reduce ? "auto" : "smooth",
              block: "start",
            })
          }}
          ariaLabel={t("sections.serviceCategories")}
        />
      </div>
      {list}
    </div>
  )
}

// A group's rule, under its question: optional, pick one, up to three…
function useGroupHint() {
  const t = useTranslations("public.booking")
  return (group: BookingAddonGroup): string => {
    if (group.minSelect > 0) return t("extrasRequired", { min: group.minSelect })
    if (group.maxSelect !== null && group.maxSelect < group.options.length) {
      return t("extrasUpTo", { max: group.maxSelect })
    }
    return t("optional")
  }
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
  const priceLabel = usePriceLabel()
  const formatDuration = useFormatDuration()
  const groupHint = useGroupHint()
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
            <FieldDescription>{groupHint(group)}</FieldDescription>
            <FieldGroup data-slot="checkbox-group" className="gap-3">
              {group.options.map((option) => {
                const checked = value.includes(option.id)
                const price = priceLabel(option.priceMinor, page.currency)
                const extra = [
                  option.durationMinutes > 0 &&
                    `+${formatDuration(option.durationMinutes)}`,
                  price && option.priceMinor !== 0 && `+${price}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <FieldLabel
                    variant="box"
                    key={option.id}
                    htmlFor={`extra-${option.id}`}
                  >
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
  const t = useTranslations("public.booking")
  const options = [
    {
      id: ANYONE,
      name: t("anyone"),
      detail: t("whoeverFree"),
      photoUrl: null,
    },
    ...team.map((member) => ({ ...member, detail: member.description })),
  ]
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(String(next))}
      aria-label={t("titles.member")}
    >
      {options.map((option) => (
        <FieldLabel
          variant="box"
          key={option.id}
          htmlFor={`member-${option.id}`}
        >
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

// "Pay later" in the payment choice, beside the business's ways' ids.
export const PAY_LATER = "later"

// How the customer will pay, when the business lists ways to pay outside
// the app: one of them, or at the visit where the business allows it. Only
// the ways' names show here; where to send the money comes once booked.
export function PaymentStep({
  slug,
  payments,
  value,
  onChange,
  proof,
  onProofChange,
  disabled,
}: {
  slug: string
  payments: PaymentOptions
  // A way's id, PAY_LATER, or "" while nothing is picked.
  value: string
  onChange: (value: string) => void
  // The payment proof, where the business asks for it: the picked way
  // then shows where to send the money, and the proof is added here,
  // before the booking is confirmed (docs/plans/payment-proof.md, PP10).
  proof: File | null
  onProofChange: (file: File) => void
  disabled?: boolean
}) {
  const t = useTranslations("public.booking")
  const tProof = useTranslations("public.account.payment")
  const picked = payments.asksProof
    ? payments.methods.find((method) => method.id === value)
    : undefined
  const pickedId = picked?.id
  // Where to send the money, by way: asked for once a way is picked.
  // null = it could not be read.
  const [details, setDetails] = useState<Record<string, string | null>>({})
  const known = pickedId !== undefined && pickedId in details
  useEffect(() => {
    if (pickedId === undefined || known) return
    let current = true
    void getPaymentDetails(slug, pickedId)
      .catch(() => null)
      .then((found) => {
        if (current) setDetails((all) => ({ ...all, [pickedId]: found }))
      })
    return () => {
      current = false
    }
  }, [slug, pickedId, known])
  const options = [
    ...payments.methods.map((method) => ({
      id: method.id,
      name: method.name,
      detail: t(`payment.types.${method.type}`),
      icon: <PaymentTypeIcon type={method.type} />,
    })),
    ...(payments.payLater
      ? [
          {
            id: PAY_LATER,
            name: t("payment.later"),
            detail: t("payment.laterHint"),
            icon: <ClockIcon />,
          },
        ]
      : []),
  ]
  return (
    <div className="flex flex-col gap-4">
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(String(next))}
      aria-label={t("titles.payment")}
    >
      {options.map((option) => (
        <FieldLabel
          variant="box"
          key={option.id}
          htmlFor={`payment-${option.id}`}
        >
          <Field orientation="horizontal">
            <Avatar size="lg">
              <AvatarFallback>{option.icon}</AvatarFallback>
            </Avatar>
            <FieldContent>
              <FieldTitle>{option.name}</FieldTitle>
              <FieldDescription>{option.detail}</FieldDescription>
            </FieldContent>
            <RadioGroupItem value={option.id} id={`payment-${option.id}`} />
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
      {picked && (
        <Item variant="muted">
          <ItemContent className="min-w-0 gap-3">
            <div className="flex flex-col gap-1 text-sm" aria-live="polite">
              <p className="font-medium">
                {t("payment.payWith", { name: picked.name })}
              </p>
              {!known ? (
                <Skeleton className="h-5 w-40" />
              ) : details[picked.id] ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 break-words whitespace-pre-line select-all">
                    {details[picked.id]}
                  </p>
                  <CopyButton
                    value={details[picked.id] ?? ""}
                    copyLabel={t("payment.copy")}
                    copiedLabel={t("payment.copied")}
                    failedLabel={tProof("failed")}
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="min-h-11 self-start md:min-h-9"
                  onClick={() =>
                    setDetails((all) => {
                      const rest = { ...all }
                      delete rest[picked.id]
                      return rest
                    })
                  }
                >
                  {t("tryAgain")}
                </Button>
              )}
            </div>
            <PaymentProofField
              value={proof}
              onChange={onProofChange}
              disabled={disabled}
              addLabel={tProof("addProof")}
              replaceLabel={tProof("replaceProof")}
              hint={tProof("proofHint", { days: PAYMENT_RULES.proofKeepDays })}
            />
          </ItemContent>
        </Item>
      )}
    </div>
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
  const t = useTranslations("public.booking")
  const timeLabels = useTimeLabels()
  const locale = useLocale()
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
          <EmptyTitle>{t("timesFailed")}</EmptyTitle>
        </EmptyHeader>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t("tryAgain")}
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
          <EmptyTitle>{t("noTimes")}</EmptyTitle>
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
      locale={locale}
      labels={timeLabels}
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
  const t = useTranslations("public.booking")
  const locale = useLocale()
  const { name, phone } = details
  const setName = (next: string) => onDetailsChange({ name: next, phone })
  const setPhone = (next: string) => onDetailsChange({ name, phone: next })
  return (
    <form
      id={formId}
      noValidate
      // Its own section, the summary's twin, with room above it.
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ name: name.trim(), phone: phone.trim() })
      }}
    >
      <Card variant="muted">
        <CardHeader>
          <CardTitle>{t("contactTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={error === "name" || undefined}>
              <FieldLabel htmlFor="booking-name">{t("name")}</FieldLabel>
              <Input
                {...noAutofill("booking_name")}
                id="booking-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={sending}
                maxLength={BOOKING_RULES.maxCustomerName}
                aria-invalid={error === "name" || undefined}
              />
              {error === "name" && <FieldError>{t("addName")}</FieldError>}
            </Field>
            <Field data-invalid={error === "phone" || undefined}>
              <div className="flex items-center gap-1">
                <FieldLabel htmlFor="booking-phone">{t("phone")}</FieldLabel>
                {whatsappFrom && (
                  <InfoTip label={t("whatsappAbout")}>
                    {t("whatsappNotice", { business: whatsappFrom })}
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
                locale={locale}
              />
              {error === "phone" && <FieldError>{t("checkPhone")}</FieldError>}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
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
  discountMinor = 0,
  footer,
  className,
}: {
  page: BookingPage
  service: BookingService | null
  groups: BookingAddonGroup[]
  addonIds: string[]
  member: { name: string; photoUrl: string | null } | null
  slot: BookingSlot | null
  // What a redeemed reward takes off the service (docs/plans/rewards.md).
  discountMinor?: number
  footer?: React.ReactNode
  className?: string
}) {
  const t = useTranslations("public.booking")
  const locale = useLocale()
  const priceLabel = usePriceLabel()
  const formatDuration = useFormatDuration()
  const totals = service ? bookingTotals(service, groups, addonIds) : null
  const servicePrice = service
    ? priceLabel(service.priceMinor, page.currency)
    : null
  const total = totals
    ? priceLabel(
        discountMinor > 0
          ? totalWithReward(totals.priceMinor, discountMinor)
          : totals.priceMinor,
        page.currency
      )
    : null
  return (
    // The same soft grey box as the dashboard's "Start here" card.
    <Card variant="muted" className={className}>
      {/* Like a Wallet pass: a calendar and the name on top, then when, big. */}
      <CardHeader className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback>
            <CalendarIcon className="size-5" />
          </AvatarFallback>
        </Avatar>
        <CardTitle className="min-w-0 truncate">{page.name}</CardTitle>
      </CardHeader>
      {(service || slot) && (
        <CardContent className="flex flex-col gap-4 text-sm">
          {slot && (
            <div className="flex flex-col gap-0.5">
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatClock(slot.time, locale)}
              </p>
              <p className="text-muted-foreground">
                {formatDay(slot.date, locale)}
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
                    {member && ` · ${t("with", { name: member.name })}`}
                  </ItemDescription>
                </ItemContent>
                {servicePrice && (
                  <ItemActions className="tabular-nums">
                    {servicePrice}
                  </ItemActions>
                )}
              </Item>
              {totals.extras.map((extra) => {
                const price = priceLabel(extra.priceMinor, page.currency)
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
              {discountMinor > 0 && (
                <>
                  <ItemSeparator className="my-0" />
                  <Item size="xs" className="px-0">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="font-normal">
                        {t("reward.title")}
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions className="text-muted-foreground tabular-nums">
                      {formatPrice(-discountMinor, page.currency, locale)}
                    </ItemActions>
                  </Item>
                </>
              )}
              {total && (
                <>
                  <ItemSeparator className="my-0" />
                  <Item size="xs" className="px-0">
                    <ItemContent>
                      <ItemTitle className="font-semibold">
                        {t("total")}
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
  discountMinor = 0,
}: {
  page: BookingPage
  service: BookingService | null
  groups: BookingAddonGroup[]
  addonIds: string[]
  discountMinor?: number
}) {
  const t = useTranslations("public.booking")
  const priceLabel = usePriceLabel()
  const formatDuration = useFormatDuration()
  if (!service) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("titles.service")}
      </p>
    )
  }
  const totals = bookingTotals(service, groups, addonIds)
  const price = priceLabel(
    discountMinor > 0
      ? totalWithReward(totals.priceMinor, discountMinor)
      : totals.priceMinor,
    page.currency
  )
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

// The last step: the business's key points as cards, then one line saying
// that booking agrees to them and to its policies (each a link, opened in a
// new tab so the booking stays as it is), like Fresha. No box ticked in
// advance: confirming under the line is the agreement.
export function PoliciesStep({
  slug,
  policies,
}: {
  slug: string
  policies: BookingPolicies
}) {
  const t = useTranslations("public")
  const locale = useLocale()
  const language = languageOf(locale)
  // A standard policy takes its article ("the", "la"); the owner's own goes
  // by its title alone, since its article can't be known.
  const links = policies.documents.map((policy) => (
    <span key={policy.id}>
      {policy.kind && <>{t(`policies.articles.${policy.kind}`)} </>}
      <a
        href={`/b/${slug}/policies/${policySegment(policy)}?lang=${language}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {policy.kind ? t(`policies.${policy.kind}`) : policy.title}
      </a>
    </span>
  ))
  // "the A, the B and the C", joined the language's own way.
  const sentence =
    links.length > 0
      ? new Intl.ListFormat(locale, { type: "conjunction" })
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
            <Item key={point.id} variant="box" className="items-start">
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
      <p className="text-sm text-muted-foreground">
        {sentence ? (
          <>
            {t("booking.agreeTo")} {sentence}.
          </>
        ) : (
          t("booking.agreeToThese")
        )}
      </p>
    </div>
  )
}

// The customer's reward on the details step (docs/plans/rewards.md, RW7):
// a switch to redeem the one that saves the most on this service; or, for
// someone the rewards cannot be shown to yet, the one step that gets them
// there. Nothing when there is nothing to offer.
export function RewardField({
  rewards,
  offer,
  currency,
  on,
  onChange,
  loginHref,
  disabled,
}: {
  rewards: MyRewards
  offer: HeldReward | null
  currency: string
  on: boolean
  onChange: (on: boolean) => void
  // Where signing in comes back to: this booking.
  loginHref: string
  disabled: boolean
}) {
  const t = useTranslations("public.booking.reward")
  const words = useRewardWords(currency)
  if (rewards.state === "signedOut" || rewards.state === "noPhone") {
    const signedOut = rewards.state === "signedOut"
    return (
      <Item variant="muted">
        <ItemMedia variant="icon">
          <GiftIcon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>{t(signedOut ? "signIn" : "addPhone")}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={signedOut ? loginHref : ACCOUNT_ADD_PHONE_PATH} />
            }
          >
            {t(signedOut ? "signInAction" : "addPhoneAction")}
          </Button>
        </ItemActions>
      </Item>
    )
  }
  if (!offer) return null
  return (
    <Item variant="outline">
      <Field orientation="horizontal" className="min-h-11">
        <FieldContent>
          <FieldLabel htmlFor="redeem-reward">
            {t("redeem", { reward: words.reward(offer.reward) })}
          </FieldLabel>
        </FieldContent>
        <Switch
          id="redeem-reward"
          checked={on}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </Field>
    </Item>
  )
}
