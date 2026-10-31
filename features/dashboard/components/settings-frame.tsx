"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import {
  BellIcon,
  ClockIcon,
  ImageIcon,
  LanguagesIcon,
  StoreIcon,
} from "@/components/ui/icons"

import { SectionParts } from "@/components/section-parts"
import { useOwnerMessages } from "../i18n/provider"

// Settings' parts, in order. Details is the page itself; each other part is
// its own route below it (app/(owner)/dashboard/[businessId]/settings/).
const PARTS = [
  { id: "details", icon: StoreIcon },
  { id: "hours", icon: ClockIcon },
  { id: "portfolio", icon: ImageIcon },
  { id: "spanish", icon: LanguagesIcon },
  { id: "notifications", icon: BellIcon },
] as const

type Part = (typeof PARTS)[number]["id"]

// Settings' frame around its parts: the shared SectionParts, as on
// Automations (D19): tabs on a computer, a list on a phone.
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
  const part = PARTS.find((item) => item.id === segment)?.id ?? "details"

  return (
    <SectionParts
      title={m.shell.nav.settings}
      parts={PARTS.map((item) => ({
        id: item.id,
        label: m.settings.parts[item.id],
        href: hrefOf(item.id),
        icon: item.icon,
      }))}
      current={part}
      ariaLabel={m.settings.partsLabel}
    >
      {children}
    </SectionParts>
  )
}
