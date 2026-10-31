import Link from "next/link"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Counts as cards: two across on a phone, up to four on a computer. With an
// `href` a card opens that list (the Notifications Overview opens Activity
// filtered, D36); the admin's Overview shows them as plain counts.
export function StatCards({
  stats,
  locale,
}: {
  stats: { label: string; value: number; href?: string }[]
  locale: string
}) {
  const number = new Intl.NumberFormat(locale)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const card = (
          <Card size="sm" className={stat.href ? "h-full transition-colors hover:bg-muted" : undefined}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {number.format(stat.value)}
              </CardTitle>
            </CardHeader>
          </Card>
        )
        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {card}
          </Link>
        ) : (
          <div key={stat.label}>{card}</div>
        )
      })}
    </div>
  )
}
