"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import { useTranslations } from "next-intl"

import { SectionParts } from "@/components/section-parts"
import { EMAIL_BASE, EMAIL_PARTS, type EmailPart } from "../utils/email-parts"

// The admin's Email parts as tabs: the same shared part as WhatsApp's.
export function EmailFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin")
  const segment = useSelectedLayoutSegment()
  const current = EMAIL_PARTS.find((part) => part === segment) ?? "overview"
  const hrefOf = (id: EmailPart) => (id === "overview" ? EMAIL_BASE : `${EMAIL_BASE}/${id}`)
  return (
    <SectionParts
      title={t("nav.email")}
      ariaLabel={t("email.partsLabel")}
      current={current}
      parts={EMAIL_PARTS.map((part) => ({
        id: part,
        label: t(`email.parts.${part}`),
        href: hrefOf(part),
      }))}
    >
      {children}
    </SectionParts>
  )
}
