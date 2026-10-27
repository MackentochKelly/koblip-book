import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// A Google rating: a filled star, the score, then the number of reviews.
export function Rating({
  rating,
  reviewCount,
  className,
}: {
  rating: number
  reviewCount?: number | null
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
          ({reviewCount.toLocaleString("en-US")})
        </span>
      )}
    </span>
  )
}
