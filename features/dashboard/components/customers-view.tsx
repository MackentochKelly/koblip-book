"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronRightIcon, SearchIcon, UsersIcon } from "@/components/ui/icons"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
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
import { Separator } from "@/components/ui/separator"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { initials } from "@/lib/initials"
import type { OwnerBooking, OwnerCustomer } from "../types"
import { BookingStatusBadge } from "./booking-status-badge"
import { ContactButtons } from "./contact-buttons"
import { noAutofill } from "@/lib/no-autofill"
import type { OwnerMessages } from "../i18n"
import { useOwnerMessages } from "../i18n/provider"

// Everyone who booked, from their bookings. Opening one shows their visits;
// the open customer is in the address (?customer=), so their bookings load
// on the server.
export function CustomersView({
  customers,
  openKey,
  openBookings,
}: {
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.people(customers.length)}
        </p>
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
            <EmptyTitle>
              {needle ? t.noneFound : t.none}
            </EmptyTitle>
          </EmptyHeader>
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
