import { Badge } from "@/components/ui/badge"
import { CircleCheckIcon, ClockIcon } from "@/components/ui/icons"
import type { TemplateReview } from "@/types/whatsapp"

// Meta's review of a WhatsApp message as one Badge, the same on the
// business's Auto messages page and in the admin (D36): approved with a
// check, in review with a clock, refused in red, a draft plain. Words come
// from the caller, in its language.
export function MetaStatusBadge({
  review,
  labels,
  className,
}: {
  review: TemplateReview
  labels: Record<TemplateReview, string>
  className?: string
}) {
  return (
    <Badge
      variant={review === "rejected" ? "destructive" : review === "approved" ? "secondary" : "outline"}
      className={className}
    >
      {review === "approved" && <CircleCheckIcon data-icon="inline-start" className="text-success" />}
      {review === "waiting" && <ClockIcon data-icon="inline-start" />}
      {labels[review]}
    </Badge>
  )
}
