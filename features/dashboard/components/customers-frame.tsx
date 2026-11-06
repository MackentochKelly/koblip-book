"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"

import { SectionParts } from "@/components/section-parts"

const PARTS = ["people", "reviews"] as const

type Part = (typeof PARTS)[number]

// The Customers page's frame (client account D15): People is the page
// itself, Reviews its own route below it. The title is in the top bar and
// the menu, so the tabs lead.
export function CustomersFrame({
  businessId,
  children,
}: {
  businessId: string
  children: React.ReactNode
}) {
  const t = useTranslations("owner.bookings.customers")
  const segment = useSelectedLayoutSegment()
  const base = `/dashboard/${businessId}/customers`
  const hrefOf = (part: Part) => (part === "people" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item === segment) ?? "people"
  return (
    <SectionParts
      title={t("title")}
      titleHidden
      parts={PARTS.map((item) => ({
        id: item,
        label: t(`parts.${item}`),
        href: hrefOf(item),
      }))}
      current={part}
      ariaLabel={t("parts.label")}
    >
      {children}
    </SectionParts>
  )
}
