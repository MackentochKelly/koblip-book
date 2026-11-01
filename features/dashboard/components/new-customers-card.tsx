"use client"

import Link from "next/link"
import { ChevronRightIcon } from "@/components/ui/icons"

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
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { formatDayShort } from "@/lib/format-booking-time"
import { initials } from "@/lib/initials"
import { useOwnerMessages } from "../i18n/provider"

// The New customers widget: who booked for the first time lately, newest
// first, and View all for the Customers page.
export function NewCustomersCard({
  customers,
  href,
}: {
  customers: Array<{ key: string; name: string; date: string }>
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
