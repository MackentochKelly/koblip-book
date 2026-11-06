import { cn } from "@/lib/utils"

// How many dots show at once; more photos slide the row, like Instagram.
const VISIBLE = 5

// Instagram's dots under a swiped photo: the one on screen bright, the rest
// faint, and at most five at once. When there are more photos past an end,
// the end dot is smaller, so the row hints there is more to swipe.
export function CarouselDots({
  total,
  current,
  className,
}: {
  total: number
  current: number
  className?: string
}) {
  if (total < 2) return null
  const first = Math.min(
    Math.max(current - Math.floor(VISIBLE / 2), 0),
    Math.max(total - VISIBLE, 0)
  )
  const last = Math.min(first + VISIBLE, total) - 1
  const shown = Array.from({ length: last - first + 1 }, (_, i) => first + i)

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none flex items-center gap-1.5", className)}
    >
      {shown.map((index) => {
        const edge =
          (index === first && first > 0) || (index === last && last < total - 1)
        return (
          <span
            key={index}
            className={cn(
              "rounded-full bg-photo-scrim-foreground transition-all duration-200",
              index === current ? "opacity-100" : "opacity-60",
              edge && index !== current ? "size-1.5" : "size-2"
            )}
          />
        )
      })}
    </div>
  )
}
