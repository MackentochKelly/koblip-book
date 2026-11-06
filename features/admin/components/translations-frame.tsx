"use client"

import { useSelectedLayoutSegments } from "next/navigation"
import { useTranslations } from "next-intl"

import { SectionParts } from "@/components/section-parts"
import {
  TRANSLATION_PARTS,
  translationPartHref,
} from "../utils/translation-parts"

// Admin → Translations (G5): its parts as tabs, the same shared part as the
// WhatsApp section. One text's own screen leads back to its list.
export function TranslationsFrame({ children }: { children: React.ReactNode }) {
  const nav = useTranslations("admin.nav")
  const t = useTranslations("admin.translations")
  const [segment, ...inside] = useSelectedLayoutSegments()
  const current =
    TRANSLATION_PARTS.find((part) => part === segment) ?? "overview"
  return (
    <SectionParts
      title={nav("translations")}
      ariaLabel={t("partsLabel")}
      current={current}
      parts={TRANSLATION_PARTS.map((part) => ({
        id: part,
        label: t(`parts.${part}`),
        href: translationPartHref(part),
      }))}
      back={
        inside.length && current !== "overview"
          ? { href: translationPartHref(current), label: t(`parts.${current}`) }
          : undefined
      }
    >
      {children}
    </SectionParts>
  )
}
