import Link from "next/link"
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "cn"

// A stat's colour: its icon, on a soft circle of the same colour. In dark
// mode the brand's own colour is too dark to read on the card, so primary
// takes the brand's light tint there.
const TONES = {
  primary: "bg-primary/10 text-primary dark:bg-chart-1/15 dark:text-chart-1",
  info: "bg-info/10 text-info dark:bg-info/15",
  success: "bg-success/10 text-success dark:bg-success/20",
  warning: "bg-warning/10 text-warning dark:bg-warning/15",
  destructive: "bg-destructive/10 text-destructive dark:bg-destructive/15",
} as const

export type StatTone = keyof typeof TONES

export interface Stat {
  icon: React.ReactNode
  // The icon's colour; primary when left out.
  tone?: StatTone
  label: string
  value: string
  // One short line under the number: what it counts.
  hint?: string
  // Whole percent against the period before; null hides the badge.
  change?: number | null
  // False for numbers that should go down, like no-shows.
  upIsGood?: boolean
}

// Key numbers in one card, split by thin lines: two across on a phone, four
// on a computer. Each has its icon on a soft coloured circle beside its
// label (a little smaller on a phone, so the label fits), then the number with how it moved against the period before
// beside it (green when it went the right way), and a short line saying what
// it counts. With an `href` each number opens that page, and each box
// lights up on its own under the mouse.
export function StatStrip({ stats, href }: { stats: Stat[]; href?: string }) {
  return (
    <Card className="gap-0 py-0">
      {/* The lines between numbers match the card's own edge. */}
      <dl className="grid grid-cols-2 gap-px bg-foreground/5 lg:grid-cols-4 dark:bg-foreground/10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "flex flex-col gap-3 bg-card px-3 py-4 md:p-5",
              href &&
                "relative transition-colors hover:bg-muted has-[a:focus-visible]:bg-muted has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-inset"
            )}
          >
            <dt className="flex items-center gap-2 font-medium md:gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
                  TONES[stat.tone ?? "primary"]
                )}
              >
                {stat.icon}
              </span>
              {href ? (
                // The label is the box's link; it covers the whole box.
                <Link
                  href={href}
                  className="min-w-0 truncate outline-none after:absolute after:inset-0 max-md:text-sm"
                >
                  {stat.label}
                </Link>
              ) : (
                <span className="min-w-0 truncate max-md:text-sm">
                  {stat.label}
                </span>
              )}
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
            {stat.hint && (
              <dd className="-mt-2 truncate text-sm text-muted-foreground">
                {stat.hint}
              </dd>
            )}
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
