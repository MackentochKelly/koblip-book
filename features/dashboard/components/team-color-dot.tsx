import type { TeamColor } from "@/lib/team-rules"
import { cn } from "@/lib/utils"

// Whole class names, so Tailwind sees each one.
const FILL: Record<TeamColor, string> = {
  blue: "bg-team-blue",
  green: "bg-team-green",
  orange: "bg-team-orange",
  purple: "bg-team-purple",
  rose: "bg-team-rose",
  teal: "bg-team-teal",
}

// The edge of a calendar block in that person's colour.
export const TEAM_EDGE: Record<TeamColor, string> = {
  blue: "border-l-team-blue",
  green: "border-l-team-green",
  orange: "border-l-team-orange",
  purple: "border-l-team-purple",
  rose: "border-l-team-rose",
  teal: "border-l-team-teal",
}

// A team member's calendar colour, as a small dot. Decoration only: their
// name is always beside it.
export function TeamColorDot({
  color,
  className,
}: {
  color: TeamColor
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-3 shrink-0 self-center rounded-full",
        FILL[color],
        className
      )}
    />
  )
}
