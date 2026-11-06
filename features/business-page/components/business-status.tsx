import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import type { Business } from "../types"

// Closed for now or for good (Google's word first), else open now or closed
// now from the business's own hours.
export function BusinessStatus({
  status,
  open,
}: {
  status: Business["status"]
  open: boolean | null
}) {
  const t = useTranslations("public.status")
  if (status === "temporarily_closed") {
    return <Badge variant="destructive">{t("temporarilyClosed")}</Badge>
  }
  if (status === "closed") {
    return <Badge variant="destructive">{t("closed")}</Badge>
  }
  if (open === null) return null
  return (
    <Badge variant={open ? "success" : "destructive"}>
      {open ? t("openNow") : t("closedNow")}
    </Badge>
  )
}
