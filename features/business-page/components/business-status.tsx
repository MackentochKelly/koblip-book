import { Badge } from "@/components/ui/badge"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import type { Business } from "../types"

// Closed for now or for good (Google's word first), else open now or closed
// now from the business's own hours.
export function BusinessStatus({
  status,
  open,
  language,
}: {
  status: Business["status"]
  open: boolean | null
  language: PageLanguage
}) {
  const m = messagesFor(language).status
  if (status === "temporarily_closed") {
    return <Badge variant="outline">{m.temporarilyClosed}</Badge>
  }
  if (status === "closed") {
    return <Badge variant="destructive">{m.closed}</Badge>
  }
  if (open === null) return null
  return (
    <Badge variant={open ? "secondary" : "outline"}>
      {open ? m.openNow : m.closedNow}
    </Badge>
  )
}
