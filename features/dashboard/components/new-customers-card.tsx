"use client"

import type { Route } from "next"
import Link from "next/link"
import {
  ChevronRightIcon,
  ContactIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/ui/icons"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { formatDayShort } from "@/lib/format-booking-time"
import { initials } from "@/lib/initials"
import { phoneLinks } from "@/lib/phone-link"
import { useOwnerMessages } from "../i18n/provider"

// The New customers widget: who booked for the first time lately, newest
// first, each with a ⋮ menu (open them on the Customers page, call or
// WhatsApp them), and View all for the Customers page.
export function NewCustomersCard({
  customers,
  href,
}: {
  customers: Array<{
    key: string
    name: string
    phone: string | null
    date: string
  }>
  href: string
}) {
  const m = useOwnerMessages()
  const t = m.widgets
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.names.newCustomers}</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={href} />}
          >
            {t.viewAll}
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {customers.length > 0 ? (
          <ItemGroup>
            {customers.map((customer) => (
              <Item key={customer.key} size="sm">
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback>{initials(customer.name) || "?"}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{customer.name}</ItemTitle>
                  <ItemDescription>
                    {t.firstVisit} · {formatDayShort(customer.date, m.locale)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <CustomerMenu
                    href={`${href}?customer=${encodeURIComponent(customer.key)}`}
                    phone={customer.phone}
                  />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <p className="text-muted-foreground">{t.noNewCustomers}</p>
        )}
      </CardContent>
    </Card>
  )
}

function CustomerMenu({ href, phone }: { href: string; phone: string | null }) {
  const t = useOwnerMessages().bookings
  const links = phone ? phoneLinks(phone) : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t.list.actions} />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={href as Route} />}>
            <ContactIcon />
            {t.list.open}
          </DropdownMenuItem>
          {links && (
            <>
              <DropdownMenuItem render={<a href={links.tel} />}>
                <PhoneIcon />
                {t.contact.call}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <a href={links.whatsapp} target="_blank" rel="noreferrer" />
                }
              >
                <WhatsAppIcon />
                {t.contact.whatsapp}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
