"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"

import { SectionParts } from "@/components/section-parts"

const PARTS = ["rules", "activity"] as const

type Part = (typeof PARTS)[number]

// The Rewards page's frame (docs/plans/rewards.md, RW-9): the rules are
// the page itself, Activity its own route below it. The title is in the
// top bar and the menu, so the tabs lead.
export function RewardsFrame({
  businessId,
  children,
}: {
  businessId: string
  children: React.ReactNode
}) {
  const t = useTranslations("owner.rewards")
  const segment = useSelectedLayoutSegment()
  const base = `/dashboard/${businessId}/rewards`
  const hrefOf = (part: Part) => (part === "rules" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item === segment) ?? "rules"
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
