"use client"

import { FloatingLink } from "@/components/floating-link"
import { useMessages } from "@/components/language-provider"
import { ArrowLeftIcon } from "@/components/ui/icons"

// Shown only to the business's owner on their own public page: one round
// icon back to their dashboard, which they can drag out of the way.
export function OwnerBackButton({ businessId }: { businessId: string }) {
  const label = useMessages().page.backToDashboard
  return (
    <FloatingLink
      id="owner-back"
      href={"/dashboard/" + businessId}
      label={label}
    >
      <ArrowLeftIcon />
    </FloatingLink>
  )
}
