import { useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"

export function BusinessAbout({ description }: { description: string | null }) {
  const t = useTranslations("public.sections")
  if (!description) {
    return null
  }
  return (
    <PageSection id="about" title={t("about")}>
      <p className="text-sm leading-relaxed whitespace-pre-line">
        {description}
      </p>
    </PageSection>
  )
}
