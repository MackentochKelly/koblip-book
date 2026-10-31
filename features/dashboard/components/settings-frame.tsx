"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { SectionParts } from "@/components/section-parts"
import { useOwnerMessages } from "../i18n/provider"

// Settings' parts, in order. Details is the page itself; each other part is
// its own route below it (app/(owner)/dashboard/[businessId]/settings/).
const PARTS = [
  "details",
  "hours",
  "portfolio",
  "spanish",
  "notifications",
] as const

type Part = (typeof PARTS)[number]

// Settings' frame around its parts: the shared SectionParts, as on
// Automations (D19): a row of tabs, pinned under the top bar on a phone.
export function SettingsFrame({
  businessId,
  children,
}: {
  businessId: string
  children: React.ReactNode
}) {
  const m = useOwnerMessages()
  const segment = useSelectedLayoutSegment()
  const base = `/dashboard/${businessId}/settings`
  const hrefOf = (part: Part) => (part === "details" ? base : `${base}/${part}`)
  const part = PARTS.find((item) => item === segment) ?? "details"

  return (
    <SectionParts
      title={m.shell.nav.settings}
      parts={PARTS.map((item) => ({
        id: item,
        label: m.settings.parts[item],
        href: hrefOf(item),
      }))}
      current={part}
      ariaLabel={m.settings.partsLabel}
    >
      {children}
    </SectionParts>
  )
}
