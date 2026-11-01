import { cn } from "@/lib/utils"

// An icon on a soft circle of its own colour. In dark mode the brand's own
// colour is too dark to read on a card, so primary takes the brand's light
// tint there.
const TONES = {
  primary: "bg-primary/10 text-primary dark:bg-chart-1/15 dark:text-chart-1",
  info: "bg-info/10 text-info dark:bg-info/15",
  success: "bg-success/10 text-success dark:bg-success/20",
  warning: "bg-warning/10 text-warning dark:bg-warning/15",
  destructive: "bg-destructive/10 text-destructive dark:bg-destructive/15",
} as const

export type Tone = keyof typeof TONES

export function ToneIcon({
  tone = "primary",
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
