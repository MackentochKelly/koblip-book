import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

export interface Stat {
  icon: React.ReactNode
  label: string
  value: string
  // Under the number, e.g. "Last 7 days".
  note: string
  // Whole percent against the period before; null hides the badge.
  change: number | null
  // False for numbers that should go down, like no-shows.
  upIsGood?: boolean
}

// Key numbers in one card, split by thin lines: two across on a phone, four
// on a computer. Each has an icon and label, the number, and how it moved
// against the period before (green when it went the right way).
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <Card className="gap-0 py-0">
      <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-3 bg-card p-5">
            <dt className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4.5 [&_svg]:text-primary">
              {stat.icon}
              <span className="truncate">{stat.label}</span>
            </dt>
            <dd className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl lg:text-3xl">
              {stat.value}
            </dd>
            <dd className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {stat.note}
              <Change change={stat.change} upIsGood={stat.upIsGood ?? true} />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
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
