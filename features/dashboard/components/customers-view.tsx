"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { initials } from "@/lib/initials"
import type { OwnerBooking, OwnerCustomer } from "../types"
import { addCustomer } from "../api/customer-actions"
import { BookingStatusBadge } from "./booking-status-badge"
import { ContactButtons } from "./contact-buttons"
import { useTabBarAction } from "./tab-bar-action"
import { noAutofill } from "@/lib/no-autofill"
import type { OwnerMessages } from "../i18n"
import { useOwnerMessages } from "../i18n/provider"

// Everyone who booked, from their bookings, and anyone the owner added by
// hand. Opening one shows their visits; the open customer is in the address
// (?customer=), so their bookings load on the server.
export function CustomersView({
  businessId,
  customers,
  openKey,
  openBookings,
}: {
  businessId: string
  customers: OwnerCustomer[]
  openKey: string | null
  openBookings: OwnerBooking[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const m = useOwnerMessages()
  const t = m.bookings.customers
  const [query, setQuery] = useState("")
  const [closing, setClosing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const startAdding = () => {
    setFormKey((value) => value + 1)
    setAdding(true)
  }
  // On a phone the tab bar's middle button adds a customer.
  useTabBarAction({ label: t.add, onClick: startAdding })
  // Once the address has no customer in it, the next one opens normally.
  if (!openKey && closing) setClosing(false)
  const opened = customers.find((customer) => customer.key === openKey) ?? null

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(needle) ||
          (customer.phone ?? "").includes(needle)
      )
    : customers

  const open = (key: string) => {
    setClosing(false)
    router.push(`${pathname}?customer=${encodeURIComponent(key)}`, {
      scroll: false,
    })
  }
  const close = () => {
    setClosing(true)
    router.replace(pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* On a phone the top bar names the page and Add is the tab bar's
          middle button, so Add here is a computer's. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.people(customers.length)}
          </p>
        </div>
        <Button className="max-md:hidden" onClick={startAdding}>
          <PlusIcon data-icon="inline-start" />
          {m.catalog.common.add}
        </Button>
      </div>
      {customers.length > 0 && (
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            {...noAutofill("customers")}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            aria-label={t.searchLabel}
          />
        </InputGroup>
      )}
      {shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{needle ? t.noneFound : t.none}</EmptyTitle>
          </EmptyHeader>
          {needle && (
            <EmptyContent>
              <Button variant="outline" onClick={() => setQuery("")}>
                {t.clearSearch}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {shown.map((customer) => (
            <Item
              key={customer.key}
              variant="outline"
              render={
                <button type="button" onClick={() => open(customer.key)} />
              }
              className="text-left"
            >
              <ItemMedia>
                <Avatar>
                  <AvatarFallback>{initials(customer.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{customer.name}</ItemTitle>
                <ItemDescription>{summary(customer, m)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRightIcon />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      <ResponsivePanel
        open={opened !== null && !closing}
        onClose={close}
        title={opened?.name ?? t.customer}
      >
        {opened && (
          <CustomerDetails customer={opened} bookings={openBookings} />
        )}
      </ResponsivePanel>

      <AddCustomerPanel
        key={formKey}
        businessId={businessId}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </div>
  )
}

function summary(customer: OwnerCustomer, m: OwnerMessages): string {
  const t = m.bookings.customers
  const visits = t.visits(customer.completed)
  if (customer.nextBooking)
    return t.next(visits, formatDay(customer.nextBooking, m.locale))
  if (customer.lastVisit)
    return t.last(visits, formatDay(customer.lastVisit, m.locale))
  return t.bookings(customer.bookings)
}

function CustomerDetails({
  customer,
  bookings,
}: {
  customer: OwnerCustomer
  bookings: OwnerBooking[]
}) {
  const m = useOwnerMessages()
  const t = m.bookings.customers
  const stats = [
    { label: t.visitsLabel, value: String(customer.completed) },
    { label: t.noShows, value: String(customer.noShows) },
    {
      label: t.spent,
      value: formatPrice(customer.spentMinor, customer.currency, m.locale),
    },
  ]
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle>{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {customer.phone && (
        <>
          <p className="text-muted-foreground">{customer.phone}</p>
          <ContactButtons phone={customer.phone} />
        </>
      )}
      <Separator />
      <ItemGroup>
        {bookings.map((booking) => (
          <Item key={booking.id} size="sm" className="px-0">
            <ItemContent>
              <ItemTitle>
                {formatDay(booking.date, m.locale)} ·{" "}
                {formatClock(booking.time, m.locale)}
                <BookingStatusBadge status={booking.status} />
              </ItemTitle>
              <ItemDescription>
                {booking.serviceName}
                {booking.teamMemberName && ` · ${booking.teamMemberName}`}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}

const ADD_CUSTOMER_FORM = "add-customer-form"

function AddCustomerPanel({
  businessId,
  open,
  onClose,
}: {
  businessId: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const m = useOwnerMessages()
  const t = m.bookings.customers
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<"name" | "phone" | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError("name")
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) return setError("phone")
    setError(null)
    startTransition(async () => {
      const result = await addCustomer(businessId, {
        name: trimmed,
        phone: phone.trim() || null,
      }).catch(() => null)
      if (result?.ok) {
        toast.success(t.added(trimmed))
        onClose()
        router.refresh()
      } else if (result?.error === "name" || result?.error === "phone") {
        setError(result.error)
      } else if (result?.error === "exists") {
        toast.error(t.exists)
      } else {
        toast.error(m.catalog.common.failed)
      }
    })
  }

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t.add}
      footer={
        <Button type="submit" size="lg" form={ADD_CUSTOMER_FORM} disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {m.catalog.common.save}
        </Button>
      }
    >
      <form
        id={ADD_CUSTOMER_FORM}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <FieldGroup>
          <Field data-invalid={error === "name" || undefined}>
            <FieldLabel htmlFor="customer-name">{t.name}</FieldLabel>
            <Input
              {...noAutofill("customer_name")}
              id="customer-name"
              className="min-h-11 md:min-h-9"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={BOOKING_RULES.maxCustomerName}
              aria-invalid={error === "name" || undefined}
            />
            {error === "name" && <FieldError>{t.nameRequired}</FieldError>}
          </Field>
          <Field data-invalid={error === "phone" || undefined}>
            <FieldLabel htmlFor="customer-phone">{t.phone}</FieldLabel>
            <Input
              {...noAutofill("customer_phone")}
              id="customer-phone"
              type="tel"
              inputMode="tel"
              className="min-h-11 md:min-h-9"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-invalid={error === "phone" || undefined}
            />
            {error === "phone" && <FieldError>{t.badPhone}</FieldError>}
          </Field>
        </FieldGroup>
      </form>
    </ResponsivePanel>
  )
}
