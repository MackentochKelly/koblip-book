import Link from "next/link"
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { FitText } from "@/components/fit-text"
import { type Tone, ToneIcon } from "@/components/tone-icon"
import { cn } from "cn"

export interface Stat {
  icon: React.ReactNode
  // The icon's colour; primary when left out.
  tone?: Tone
  label: string
  // A number, or a part like Money for amounts.
  value: React.ReactNode
  // Whole percent against the period before; null hides the badge.
  change?: number | null
  // False for numbers that should go down, like no-shows.
  upIsGood?: boolean
  // The page this number opens, when it opens its own (else the strip's).
  href?: string
}

// As many columns as numbers on a computer, up to four.
const COLUMNS = [
  "lg:grid-cols-1",
  "lg:grid-cols-2",
  "lg:grid-cols-3",
  "lg:grid-cols-4",
]

// Key numbers in one card, split by thin lines: two across on a phone, four
// on a computer. Each box has its label at the top left (on two lines when
// it needs them, never cut off), the number right under it with how it
// moved against the period before beside it (green when it went the right
// way), and a big icon on a soft coloured circle at the right, centred
// beside both, with the same inset on both sides. A number too long for its
// room shrinks to fit rather than run into the icon (FitText). With an
// `href` (the strip's, or a number's own) the number opens that page, and
// each box lights up on its own under the mouse.
export function StatStrip({ stats, href }: { stats: Stat[]; href?: string }) {
  return (
    <Card className="gap-0 py-0">
      {/* The lines between numbers match the card's own edge. */}
      <dl
        className={cn(
          "grid grid-cols-2 gap-px bg-foreground/5 dark:bg-foreground/10",
          COLUMNS[Math.min(stats.length, 4) - 1]
        )}
      >
        {stats.map((stat) => {
          const link = stat.href ?? href
          return (
            <div
              key={stat.label}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] content-center items-center gap-x-2 gap-y-1 bg-card p-4 md:gap-x-3 md:px-10 md:py-7",
                link &&
                  "relative transition-colors hover:bg-muted has-[a:focus-visible]:bg-muted has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 has-[a:focus-visible]:ring-inset"
              )}
            >
              <dt className="flex font-medium text-muted-foreground">
                {link ? (
                  // The label is the box's link; it covers the whole box.
                  <Link
                    href={link}
                    className="min-w-0 outline-none after:absolute after:inset-0 max-md:text-sm"
                  >
                    {stat.label}
                  </Link>
                ) : (
                  <span className="min-w-0 max-md:text-sm">{stat.label}</span>
                )}
              </dt>
              <dd className="col-start-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <FitText className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
                  {stat.value}
                </FitText>
                <Change
                  change={stat.change ?? null}
                  upIsGood={stat.upIsGood ?? true}
                />
              </dd>
              {/* Only a picture, so screen readers skip it. */}
              <dd aria-hidden className="col-start-2 row-span-2 row-start-1">
                <ToneIcon
                  tone={stat.tone}
                  className="size-11 md:size-13 [&_svg]:size-6 md:[&_svg]:size-6.5"
                >
                  {stat.icon}
                </ToneIcon>
              </dd>
            </div>
          )
        })}
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
