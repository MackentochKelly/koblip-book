"use client"

import Link from "next/link"

import { RadialProgress } from "@/components/radial-progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useOwnerMessages } from "../i18n/provider"

// Home's summary: a ring for today (fills as today's bookings end), then
// tomorrow, the next 7 days and everything upcoming. Opens Analytics.
export function TodayCard({
  href,
  booked,
  done,
  others,
}: {
  href: string
  booked: number
  done: number
  others: { label: string; value: number }[]
}) {
  const m = useOwnerMessages()
  const t = m.bookings.stats
  const number = new Intl.NumberFormat(m.locale)
  return (
    <Link
      href={href}
      className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="transition-colors hover:bg-muted">
        <CardContent className="flex flex-col items-center gap-4 md:flex-row md:gap-8">
          <div className="flex flex-col items-center gap-2">
            <RadialProgress
              value={done}
              max={booked}
              number={number.format(booked)}
              label={t.today}
            />
            {booked > 0 && (
              <p className="text-sm text-muted-foreground">
                {t.done(number.format(done), number.format(booked))}
              </p>
            )}
          </div>
          <Separator className="md:hidden" />
          <Separator orientation="vertical" className="max-md:hidden" />
          <dl className="grid w-full grid-cols-3 gap-2 md:flex-1">
            {others.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1 md:items-start"
              >
                <dt className="text-xs text-muted-foreground md:text-sm">
                  {stat.label}
                </dt>
                <dd className="text-2xl font-semibold tabular-nums md:text-3xl">
                  {number.format(stat.value)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </Link>
  )
}
