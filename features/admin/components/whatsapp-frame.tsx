"use client"

import { useSelectedLayoutSegment } from "next/navigation"

import { SectionParts } from "@/components/section-parts"
import { useAdminMessages } from "../i18n/provider"
import { WHATSAPP_BASE, WHATSAPP_PARTS } from "../utils/whatsapp-parts"

// Tabs on a computer, a list on a phone: the same shared part as the
// business's WhatsApp page.
export function WhatsappFrame({ children }: { children: React.ReactNode }) {
  const m = useAdminMessages()
  const segment = useSelectedLayoutSegment()
  const current = WHATSAPP_PARTS.find((part) => part.id === segment)?.id ?? "overview"
  return (
    <SectionParts
      title={m.nav.whatsapp}
      ariaLabel={m.whatsapp.partsLabel}
      current={current}
      parts={WHATSAPP_PARTS.map((part) => ({
        id: part.id,
        icon: part.icon,
        label: m.whatsapp.parts[part.id],
        href: part.id === "overview" ? WHATSAPP_BASE : `${WHATSAPP_BASE}/${part.id}`,
      }))}
    >
      {children}
    </SectionParts>
  )
}
