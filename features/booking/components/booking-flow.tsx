"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeftIcon, CircleCheckIcon, XIcon } from "@/components/ui/icons"
import { toast } from "sonner"

import { BottomBar } from "@/components/bottom-bar"
import { BottomPanel } from "@/components/bottom-panel"
import { useMessages } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { PHONE_PATTERN } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { createBooking } from "../api/create-booking"
import type { BookingConfirmation } from "../types"
import {
  bookingTotals,
  serviceAddonGroups,
  serviceTeam,
  type BookingPage,
  type BookingSlot,
} from "./booking-page"
import {
  ANYONE,
  BookingSummary,
  BookingTotal,
  DetailsStep,
  type DetailsError,
  ExtrasStep,
  MemberStep,
  priceLabel,
  ServiceStep,
  TimeStep,
} from "./booking-steps"

type Step = "service" | "extras" | "member" | "time" | "details"

const DETAILS_FORM = "booking-details"

// Booking, like Fresha: a service, its extras when it has some, who does
// it when the team has a choice, a free day and time, then a name and
// phone. No sign-in. Each step is in the address, so the phone's back
// gesture goes one step back.
// On a computer it is a page of its own with the summary beside the steps;
// on a phone it is the shared BottomPanel over the business page, and the
// extras slide up as a second panel on top of the services.
export function BookingFlow({
  page,
  mode,
}: {
  page: BookingPage
  mode: "page" | "drawer"
}) {
  const m = useMessages()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const pushes = useRef(0)
  const [slot, setSlot] = useState<BookingSlot | null>(null)
  const [timesKey, setTimesKey] = useState(0)
  const [booked, setBooked] = useState<BookingConfirmation | null>(null)
  const [sending, setSending] = useState(false)
  const [detailsError, setDetailsError] = useState<DetailsError>(null)
  const [closing, setClosing] = useState(false)

  const language = params.get("lang")
  const businessPath = `/b/${page.slug}${language ? `?lang=${encodeURIComponent(language)}` : ""}`
  const wanted = mode === "page" || params.has("book")
  // Once the address has no booking in it, the next one opens fresh.
  if (!wanted && (closing || booked || slot)) {
    setClosing(false)
    setBooked(null)
    setSlot(null)
  }
  const open = wanted && !closing

  const service =
    page.services.find((item) => item.id === params.get("service")) ?? null
  const groups = serviceAddonGroups(page, service?.id ?? null)
  const known = new Set(
    groups.flatMap((group) => group.options.map((option) => option.id))
  )
  const addonIds = (params.get("addons") ?? "")
    .split(",")
    .filter((id) => known.has(id))
  const extrasValid = service
    ? bookingTotals(service, groups, addonIds).valid
    : false
  const team = serviceTeam(page, service?.id ?? null)
  const memberParam = params.get("member")
  const member = team.find((item) => item.id === memberParam) ?? null
  const memberChoice = member
    ? member.id
    : memberParam === ANYONE
      ? ANYONE
      : null
  const steps: Step[] = [
    "service",
    ...(groups.length > 0 ? (["extras"] as const) : []),
    ...(team.length > 1 ? (["member"] as const) : []),
    "time",
    "details",
  ]
  // A service picked on the business page starts on the next step.
  const askedParam = params.get("step") as Step | null
  const asked =
    askedParam && steps.includes(askedParam)
      ? askedParam
      : service
        ? steps[1]
        : "service"
  // A step missing what it needs falls back to the step that asks for it.
  const later = (target: Step) => steps.indexOf(asked) > steps.indexOf(target)
  const step: Step = !service
    ? "service"
    : steps.includes("extras") && later("extras") && !extrasValid
      ? "extras"
      : steps.includes("member") && later("member") && !memberChoice
        ? "member"
        : asked === "details" && !slot
          ? "time"
          : asked
  const index = steps.indexOf(step)
  const title = m.booking.titles[step]
  // On the phone sheet the extras sit on top of the services.
  const stacked = mode === "drawer" && step === "extras"

  const href = (next: URLSearchParams) => `${pathname}?${next}`
  // The steps change only the address, through the browser's own history
  // (Next.js keeps useSearchParams in sync), so a tap never reloads the
  // business page from the server.
  const pushUrl = (url: string) => window.history.pushState(null, "", url)
  const replaceUrl = (url: string) => window.history.replaceState(null, "", url)
  const withParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    return next
  }
  const go = (next: Step, from = new URLSearchParams(params)) => {
    pushes.current += 1
    from.set("step", next)
    pushUrl(href(from))
  }
  const close = () => {
    if (mode === "drawer") setClosing(true)
    else router.push(businessPath)
  }
  const back = () => {
    if (pushes.current > 0) {
      pushes.current -= 1
      window.history.back()
    } else if (index > 0) {
      replaceUrl(href(withParam("step", steps[index - 1])))
    } else {
      close()
    }
  }

  const canContinue =
    step === "service"
      ? Boolean(service)
      : step === "extras"
        ? extrasValid
        : step === "member"
          ? Boolean(memberChoice)
          : step === "time"
            ? Boolean(slot)
            : true
  const next = () => {
    if (canContinue && index < steps.length - 1) go(steps[index + 1])
  }

  const submit = async (details: { name: string; phone: string }) => {
    if (sending || !service || !slot) return
    if (!details.name) {
      setDetailsError("name")
      return
    }
    if (!PHONE_PATTERN.test(details.phone)) {
      setDetailsError("phone")
      return
    }
    setDetailsError(null)
    setSending(true)
    const result = await createBooking({
      slug: page.slug,
      serviceId: service.id,
      teamMemberId: member?.id ?? null,
      addonIds,
      date: slot.date,
      time: slot.time,
      name: details.name,
      phone: details.phone,
    }).catch(() => ({ status: "failed" as const }))
    setSending(false)
    if (result.status === "booked") {
      setBooked(result.booking)
    } else if (result.status === "taken") {
      setSlot(null)
      setTimesKey((value) => value + 1)
      replaceUrl(href(withParam("step", "time")))
      toast.error(m.booking.taken)
    } else if (
      result.status === "invalid" &&
      (result.field === "name" || result.field === "phone")
    ) {
      setDetailsError(result.field)
    } else {
      toast.error(m.booking.failed)
    }
  }

  const action =
    step === "details" ? (
      <Button type="submit" form={DETAILS_FORM} disabled={sending}>
        {sending && <Spinner data-icon="inline-start" />}
        {sending ? m.booking.sending : m.booking.confirm}
      </Button>
    ) : (
      <Button type="button" onClick={next} disabled={!canContinue}>
        {m.booking.continue}
      </Button>
    )

  const total = (
    <BookingTotal
      page={page}
      service={service}
      groups={groups}
      addonIds={addonIds}
    />
  )
  const extras = (
    <ExtrasStep
      page={page}
      groups={groups}
      value={addonIds}
      onChange={(ids) => {
        setSlot(null)
        replaceUrl(href(withParam("addons", ids.length ? ids.join(",") : null)))
      }}
    />
  )
  const services = (
    <ServiceStep
      page={page}
      value={service?.id ?? ""}
      onChange={(id) => {
        setSlot(null)
        const nextParams = withParam("service", id)
        nextParams.delete("addons")
        if (serviceAddonGroups(page, id).length > 0) {
          // Its extras come up straight away.
          if (step === "extras") {
            nextParams.set("step", "extras")
            replaceUrl(href(nextParams))
          } else {
            go("extras", nextParams)
          }
        } else {
          // Stay on this step until Continue.
          nextParams.set("step", "service")
          replaceUrl(href(nextParams))
        }
      }}
    />
  )

  const body = (
    <div className="flex min-w-0 flex-col gap-4">
      {(step === "service" || stacked) && services}
      {step === "extras" && !stacked && extras}
      {step === "member" && (
        <MemberStep
          team={team}
          value={memberChoice ?? ""}
          onChange={(id) => {
            setSlot(null)
            replaceUrl(href(withParam("member", id)))
          }}
        />
      )}
      {step === "time" && service && (
        <TimeStep
          key={`${service.id}-${member?.id ?? ANYONE}-${addonIds.join(",")}-${timesKey}`}
          page={page}
          serviceId={service.id}
          memberId={member?.id ?? null}
          addonIds={addonIds}
          slot={slot}
          onChange={setSlot}
        />
      )}
      {step === "details" && service && slot && (
        <>
          <BookingSummary
            page={page}
            service={service}
            groups={groups}
            addonIds={addonIds}
            memberName={member?.name ?? null}
            slot={slot}
            className="md:hidden"
          />
          <DetailsStep
            formId={DETAILS_FORM}
            sending={sending}
            error={detailsError}
            onSubmit={(details) => void submit(details)}
          />
        </>
      )}
    </div>
  )

  if (mode === "drawer") {
    // While the extras are on top, the sheet behind still shows the services.
    const shownIndex = stacked ? 0 : index
    return (
      <BottomPanel
        open={open}
        onClose={close}
        onClosed={() => {
          pushes.current = 0
          replaceUrl(businessPath)
        }}
        title={booked ? m.booking.booked : title}
        header={
          booked ? (
            <DrawerTitle className="sr-only">{m.booking.booked}</DrawerTitle>
          ) : (
            <DrawerHeader>
              <DrawerDescription>
                {m.booking.stepOf(shownIndex + 1, steps.length)}
              </DrawerDescription>
              <DrawerTitle className="truncate">
                {m.booking.titles[steps[shownIndex]]}
              </DrawerTitle>
            </DrawerHeader>
          )
        }
        footer={
          booked ? (
            <Button type="button" onClick={close}>
              {m.booking.done}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="me-4 min-w-0 flex-1">{total}</div>
              {shownIndex > 0 && (
                <Button type="button" variant="outline" onClick={back}>
                  {m.booking.back}
                </Button>
              )}
              {action}
            </div>
          )
        }
      >
        {booked ? <Booked page={page} booking={booked} /> : body}
        {groups.length > 0 && (
          <BottomPanel
            open={open && stacked && !booked}
            onClose={back}
            title={title}
            header={
              <DrawerHeader>
                <DrawerDescription>
                  {m.booking.stepOf(index + 1, steps.length)}
                </DrawerDescription>
                <DrawerTitle className="truncate">{title}</DrawerTitle>
              </DrawerHeader>
            }
            footer={
              <div className="flex items-center gap-2">
                <div className="me-4 min-w-0 flex-1">{total}</div>
                <Button type="button" variant="outline" onClick={back}>
                  {m.booking.back}
                </Button>
                {action}
              </div>
            }
          >
            {extras}
          </BottomPanel>
        )}
      </BottomPanel>
    )
  }

  if (booked) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
        <Booked page={page} booking={booked} />
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={businessPath} replace />}
        >
          {m.booking.backTo(page.name)}
        </Button>
      </main>
    )
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-2 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={m.booking.back}
            onClick={back}
          >
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {m.booking.stepOf(index + 1, steps.length)}
            </p>
            <h1 className="truncate text-base font-semibold">{title}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.booking.close}
            nativeButton={false}
            render={<Link href={businessPath} />}
          >
            <XIcon />
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 pt-6 pb-32 md:grid-cols-[minmax(0,1fr)_20rem] md:px-6 md:pb-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {body}
        <aside className="hidden md:block">
          <BookingSummary
            page={page}
            service={service}
            groups={groups}
            addonIds={addonIds}
            memberName={member?.name ?? null}
            slot={slot}
            footer={action}
            className="sticky top-20"
          />
        </aside>
      </main>

      <BottomBar label={title} className="md:hidden">
        <div className="me-4 min-w-0 flex-1">{total}</div>
        {action}
      </BottomBar>
    </>
  )
}

// The booking, confirmed.
function Booked({
  page,
  booking,
}: {
  page: BookingPage
  booking: BookingConfirmation
}) {
  const m = useMessages()
  const price = priceLabel(booking.priceMinor, booking.currency, m)
  return (
    <div className="flex flex-col gap-6">
      <Empty className="p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleCheckIcon />
          </EmptyMedia>
          <EmptyTitle>{m.booking.bookedTitle}</EmptyTitle>
          <EmptyDescription>{m.booking.expecting(page.name)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Card>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="font-medium">
            {formatDay(booking.date, m.locale)} ·{" "}
            {formatClock(booking.time, m.locale)}
          </p>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p>{booking.serviceName}</p>
              {booking.addons.map((addon, index) => (
                <p key={index} className="text-muted-foreground">
                  + {addon.name}
                </p>
              ))}
              <p className="text-muted-foreground">
                {formatDuration(booking.durationMinutes)}
                {booking.teamMemberName &&
                  ` · ${m.booking.with(booking.teamMemberName)}`}
              </p>
            </div>
            {price && <p>{price}</p>}
          </div>
          {booking.address && (
            <>
              <Separator />
              <p className="text-muted-foreground">{booking.address}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
