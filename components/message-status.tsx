import { MetaStatusBadge } from "@/components/meta-status-badge"
import { Badge } from "@/components/ui/badge"
import { CircleCheckIcon } from "@/components/ui/icons"
import type { TemplateReview } from "@/types/whatsapp"

export type MessageStatusLabels = {
  normalMessage: string
  template: string
  // The normal message goes out (the message is on) or not.
  sending: string
  off: string
  review: Record<TemplateReview, string>
}

// A WhatsApp message's two ways out, each with its own status: the normal
// message (inside 24 hours, sent as soon as it is saved) and the template
// (outside 24 hours, with Meta's review). The same on the business's and the
// admin's message lists (docs/plans/message-editing.md).
export function MessageStatus({
  on = true,
  review,
  labels,
}: {
  on?: boolean
  review: TemplateReview
  labels: MessageStatusLabels
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">{labels.normalMessage}</dt>
      <dd>
        <Badge variant={on ? "secondary" : "outline"}>
          {on && <CircleCheckIcon data-icon="inline-start" className="text-success" />}
          {on ? labels.sending : labels.off}
        </Badge>
      </dd>
      <dt className="text-muted-foreground">{labels.template}</dt>
      <dd>
        <MetaStatusBadge review={review} labels={labels.review} />
      </dd>
    </dl>
  )
}
