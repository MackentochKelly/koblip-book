"use client"

import { useTranslations } from "next-intl"

import { FloatingLink } from "@/components/floating-link"
import { ArrowLeftIcon } from "@/components/ui/icons"

// Shown only to the business's owner on their own public page: one round
// icon back to their dashboard, which they can drag out of the way.
export function OwnerBackButton({ businessId }: { businessId: string }) {
  const t = useTranslations("public.page")
  return (
    <FloatingLink
      id="owner-back"
      href={"/dashboard/" + businessId}
      label={t("backToDashboard")}
    >
      <ArrowLeftIcon />
    </FloatingLink>
  )
}
