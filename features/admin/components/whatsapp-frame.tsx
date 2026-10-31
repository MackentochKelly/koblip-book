"use client"

import { useSelectedLayoutSegments } from "next/navigation"

import { SectionParts } from "@/components/section-parts"
import { useAdminMessages } from "../i18n/provider"
import { WHATSAPP_BASE, WHATSAPP_PARTS, type WhatsappPart } from "../utils/whatsapp-parts"

// The parts as tabs: the same shared part as the business's WhatsApp page.
export function WhatsappFrame({ children }: { children: React.ReactNode }) {
  const m = useAdminMessages()
  const [segment, ...inside] = useSelectedLayoutSegments()
  const current = WHATSAPP_PARTS.find((part) => part.id === segment)?.id ?? "overview"
  const hrefOf = (id: WhatsappPart) => (id === "overview" ? WHATSAPP_BASE : `${WHATSAPP_BASE}/${id}`)
  return (
    <SectionParts
      title={m.nav.whatsapp}
      ariaLabel={m.whatsapp.partsLabel}
      current={current}
      parts={WHATSAPP_PARTS.map((part) => ({
        id: part.id,
        label: m.whatsapp.parts[part.id],
        href: hrefOf(part.id),
      }))}
      // A screen inside a part (one business) leads back to that part.
      back={
        inside.length && current !== "overview"
          ? { href: hrefOf(current), label: m.whatsapp.parts[current] }
          : undefined
      }
    >
      {children}
    </SectionParts>
  )
}
