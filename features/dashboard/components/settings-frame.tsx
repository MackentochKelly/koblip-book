"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"
import { SectionParts } from "@/components/section-parts"

// Settings' parts, in order. Details is the page itself; each other part is
// its own route below it (app/(owner)/dashboard/[businessId]/settings/).
const PARTS = [
  "details",
  "hours",
  "portfolio",
  "policies",
  "theme",
  "notifications",
  "account",
] as const

type Part = (typeof PARTS)[number]

// Settings' frame around its parts: the shared SectionParts, as on
// Automations (D19): a row of tabs, pinned under the top bar on a phone.
// No title on the page: the top bar and the menu already name it.
export function SettingsFrame({
  businessId,
  children,
}: {
  businessId: string
  children: React.ReactNode
}) {
  const t = useTranslations("owner.settings")
  const shell = useTranslations("owner.shell")
  const segment = useSelectedLayoutSegment()
  const base = `/dashboard/${businessId}/settings`
  const hrefOf = (part: Part) => (part === "details" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item === segment) ?? "details"

  return (
    <SectionParts
      title={shell("nav.settings")}
      titleHidden
      parts={PARTS.map((item) => ({
        id: item,
        label: t(`parts.${item}`),
        href: hrefOf(item),
      }))}
      current={part}
      ariaLabel={t("partsLabel")}
    >
      {children}
    </SectionParts>
  )
}
