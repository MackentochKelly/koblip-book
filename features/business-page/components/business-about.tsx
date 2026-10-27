import { PageSection } from "@/components/page-section"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
export function BusinessAbout({
  description,
  language,
}: {
  description: string | null
  language: PageLanguage
}) {
  if (!description) {
    return null
  }
  return (
    <PageSection id="about" title={messagesFor(language).sections.about}>
      <p className="text-sm leading-relaxed whitespace-pre-line">
        {description}
      </p>
    </PageSection>
  )
}
