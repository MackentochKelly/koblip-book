"use client"

import type { Route } from "next"
import Link from "next/link"
import { Fragment } from "react"
import {
  ChevronRightIcon,
  ContactIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/ui/icons"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
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
} from "@/components/ui/dropdown-menu"
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
import { formatDayShort } from "@/lib/format-booking-time"
import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"
import { phoneLinks } from "@/lib/phone-link"
import { useOwnerMessages } from "../i18n/provider"
import { WIDGET_PHONE_LIST_LIMIT } from "../widgets"

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
            {customers.map((customer, index) => (
              <Fragment key={customer.key}>
                {index > 0 && (
                  <ItemSeparator className={cn(phoneHidden(index))} />
                )}
                <Item size="sm" className={cn(phoneHidden(index))}>
                  <ItemMedia>
                    <Avatar>
                      <AvatarFallback>
                        {initials(customer.name) || "?"}
                      </AvatarFallback>
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
              </Fragment>
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
      <MoreMenuTrigger label={t.list.actions} />
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

// Rows past the phone's limit only show on a computer.
function phoneHidden(index: number) {
  return index >= WIDGET_PHONE_LIST_LIMIT && "max-md:hidden"
}
