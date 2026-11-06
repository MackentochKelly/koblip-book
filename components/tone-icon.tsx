import { cn } from "@/lib/utils"

// Each tone's colour, as the text colour: an icon, or a chart drawn in
// currentColor, takes it. In dark mode the brand's own colour is too dark
// to read on a card, so primary takes the brand's light tint there.
export const TONE_TEXT = {
  primary: "text-primary dark:text-chart-1",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
} as const

export type Tone = keyof typeof TONE_TEXT

// The soft circle behind a tone's icon.
const TONE_BACKGROUND: Record<Tone, string> = {
  primary: "bg-primary/10 dark:bg-chart-1/15",
  info: "bg-info/10 dark:bg-info/15",
  success: "bg-success/10 dark:bg-success/20",
  warning: "bg-warning/10 dark:bg-warning/15",
  destructive: "bg-destructive/10 dark:bg-destructive/15",
}

// An icon on a soft circle of its own colour.

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
        TONE_BACKGROUND[tone],
        TONE_TEXT[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
