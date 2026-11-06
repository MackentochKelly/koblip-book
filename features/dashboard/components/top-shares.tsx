"use client"

import { useLocale, useTranslations } from "next-intl"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { cn } from "cn"

// The theme's chart shades, most booked first; everything else is muted.
const SHADES = [
  "bg-chart-2",
  "bg-chart-1",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

// What people book most over the period, by service or by category: one
// bar split by item, then each item with its share. Past the top five, the
// rest show as one (null name).
export function TopShares({
  title,
  items,
  period,
}: {
  title: string
  items: { name: string | null; count: number }[]
  period: string
}) {
  const a = useTranslations("owner.bookings.analytics")
  const locale = useLocale()
  const number = new Intl.NumberFormat(locale)
  const percent = new Intl.NumberFormat(locale, { style: "percent" })
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const shade = (index: number, name: string | null) =>
    name === null ? "bg-muted-foreground/30" : SHADES[index % SHADES.length]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{period}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        {total === 0 ? (
          <Empty className="flex-1 border">
            <EmptyHeader>
              <EmptyTitle>{a("noData")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex h-3 gap-1" aria-hidden>
              {items.map((item, index) => (
                <div
                  key={item.name ?? ""}
                  className={cn("rounded-full", shade(index, item.name))}
                  style={{ width: `${(item.count / total) * 100}%` }}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              {items.map((item, index) => (
                <li key={item.name ?? ""} className="flex min-w-0 gap-2">
                  <span
                    className={cn(
                      "mt-1 h-3 w-1 shrink-0 rounded-full",
                      shade(index, item.name)
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-muted-foreground">
                      {item.name ?? a("otherServices")}
                    </span>
                    <span className="font-medium tabular-nums">
                      {number.format(item.count)}
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {percent.format(item.count / total)}
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
