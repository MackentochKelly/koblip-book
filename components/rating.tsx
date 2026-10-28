import { StarIcon } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

// A Google rating: a filled star, the score, then the number of reviews.
export function Rating({
  rating,
  reviewCount,
  locale = "en-US",
  className,
}: {
  rating: number
  reviewCount?: number | null
  locale?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-foreground tabular-nums",
        className
      )}
    >
      <StarIcon
        className="size-3.5 fill-warning text-warning"
        aria-hidden="true"
      />{" "}
      {rating.toFixed(1)}
      {typeof reviewCount === "number" && (
        <span className="text-muted-foreground">
          ({reviewCount.toLocaleString(locale)})
        </span>
      )}
    </span>
  )
}
