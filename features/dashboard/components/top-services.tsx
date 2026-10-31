"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { cn } from "cn"
import { useOwnerMessages } from "../i18n/provider"

// The theme's chart shades, most booked first; everything else is muted.
const SHADES = [
  "bg-chart-2",
  "bg-chart-1",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

// What people book most (last 30 days): one bar split by service, then each
// service with its share. Past the top five, the rest show as one.
export function TopServices({
  services,
}: {
  services: { name: string | null; count: number }[]
}) {
  const m = useOwnerMessages()
  const a = m.bookings.analytics
  const number = new Intl.NumberFormat(m.locale)
  const percent = new Intl.NumberFormat(m.locale, { style: "percent" })
  const total = services.reduce((sum, service) => sum + service.count, 0)
  const shade = (index: number, name: string | null) =>
    name === null ? "bg-muted-foreground/30" : SHADES[index % SHADES.length]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{a.topServices}</CardTitle>
        <CardDescription>{a.last30}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        {total === 0 ? (
          <Empty className="flex-1 border">
            <EmptyHeader>
              <EmptyTitle>{a.noData}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {number.format(total)}
              </span>
              <span className="text-muted-foreground">{a.bookings}</span>
            </div>
            <div className="flex h-3 gap-1" aria-hidden>
              {services.map((service, index) => (
                <div
                  key={service.name ?? ""}
                  className={cn("rounded-full", shade(index, service.name))}
                  style={{ width: `${(service.count / total) * 100}%` }}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              {services.map((service, index) => (
                <li key={service.name ?? ""} className="flex min-w-0 gap-2">
                  <span
                    className={cn(
                      "mt-1 h-3 w-1 shrink-0 rounded-full",
                      shade(index, service.name)
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-muted-foreground">
                      {service.name ?? a.otherServices}
                    </span>
                    <span className="font-medium tabular-nums">
                      {number.format(service.count)}
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {percent.format(service.count / total)}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
