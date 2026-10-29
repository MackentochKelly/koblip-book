import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// The one glass look on the moving gradient: see-through fill (set for
// light and dark in globals.css) and blur. Used by the header buttons, the
// Meta badge and the Search / Maps link switch.
export const glassClassName = "bg-glass backdrop-blur-md dark:bg-glass"

// The faint light edge (`glass-edge`) on the switch, the header buttons
// and the Meta badge. The fill runs under it, which makes the line brighter.
export const glassEdgeClassName = "border-glass-edge dark:border-glass-edge"

// The glass on something you tap, with the same edge: a little brighter
// on hover. Put it on an outline button or badge.
export const glassButtonClassName = cn(
  glassClassName,
  glassEdgeClassName,
  "hover:bg-background/50 dark:hover:bg-background/70"
)

// A thin soft edge around a big hero panel (home, login, first dashboard),
// in the glass frame's faint line colour, light and dark. Drawn over the
// panel's moving gradient, so it goes on the panel, not on HeroGradient
// (the voice globe uses that gradient with no edge).
export const heroEdgeClassName =
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:inset-ring after:inset-ring-glass-frame-edge"

// A frosted glass frame around a card on the moving gradient, like
// Fresha's: it blurs the gradient behind it and draws a faint edge; no drop
// shadow. Shared by the home box and the login card; its thick edge is
// `glass-frame-edge`, set for light and dark in globals.css.
export const glassFrameClassName =
  "w-full rounded-[calc(var(--radius-4xl)+--spacing(1.5))] p-1.5 inset-ring-6 inset-ring-glass-frame-edge backdrop-blur-md backdrop-saturate-(--glass-saturate)"

export function GlassCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(glassFrameClassName, className)}>
      <Card className="text-left shadow-none ring-0">
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
