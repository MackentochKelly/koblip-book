import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
} from "@/components/ui/icons"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "cn"

export interface Stat {
  icon: React.ReactNode
  label: string
  value: string
  // Whole percent against the period before; null hides the badge.
  change?: number | null
  // False for numbers that should go down, like no-shows.
  upIsGood?: boolean
}

// Key numbers in one card, split by thin lines: two across on a phone, four
// on a computer. Each has an icon and label, then the number with how it
// moved against the period before beside it (green when it went the right
// way). `caption` names the period once, at the top; with an `href` the
// whole card opens that page.
export function StatStrip({
  stats,
  caption,
  href,
}: {
  stats: Stat[]
  caption?: string
  href?: string
}) {
  const card = (
    <Card
      className={cn(
        "gap-0 py-0",
        href && "transition-colors hover:bg-muted [&_dl>div]:transition-colors hover:[&_dl>div]:bg-muted"
      )}
    >
      {caption && (
        <div className="flex items-center justify-between gap-2 px-5 pt-4 text-muted-foreground">
          {caption}
          {href && <ChevronRightIcon className="size-4" />}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-2 bg-card p-5">
            <dt className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-primary">
              {stat.icon}
              <span className="truncate">{stat.label}</span>
            </dt>
            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {stat.value}
              </span>
              <Change
                change={stat.change ?? null}
                upIsGood={stat.upIsGood ?? true}
              />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
  return href ? (
    <Link
      href={href}
      className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  ) : (
    card
  )
}

function Change({
  change,
  upIsGood,
}: {
  change: number | null
  upIsGood: boolean
}) {
  if (change === null) return null
  if (change === 0) return <Badge variant="secondary">0%</Badge>
  const up = change > 0
  return (
    <Badge variant={up === upIsGood ? "success" : "destructive"}>
      {Math.abs(change)}%
      {up ? (
        <ArrowUpIcon data-icon="inline-end" />
      ) : (
        <ArrowDownIcon data-icon="inline-end" />
      )}
    </Badge>
  )
}
