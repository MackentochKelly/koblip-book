import { LanguageMenu } from "@/components/language-menu"
import { LanguageProvider } from "@/components/language-provider"
import { SiteFooter } from "@/components/site-footer"
import { StickyHeader } from "@/components/sticky-header"
import { SiteHeader } from "@/components/site-header"
import {
  LEGAL_UPDATED,
  legalWordsFor,
  type LegalWords,
} from "@/features/legal/content"
import type { PageLanguage } from "@/lib/page-language"

// One legal page (Privacy or Terms): the home header and footer around a
// short, readable column of sections.
export function LegalPage({
  language,
  doc,
}: {
  language: PageLanguage
  doc: "privacy" | "terms"
}) {
  const words: LegalWords = legalWordsFor(language)
  const { title, sections } = words[doc]
  const updated = LEGAL_UPDATED.toLocaleDateString(language, {
    dateStyle: "long",
    timeZone: "UTC",
  })
  return (
    <LanguageProvider language={language}>
      <div className="flex min-h-dvh flex-col bg-background">
        {/* The header stays on top while the page scrolls. */}
        <StickyHeader>
          <SiteHeader control={<LanguageMenu />} />
        </StickyHeader>
        <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-8 px-4 pt-32 pb-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {words.updated}: {updated}
            </p>
          </div>
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">{section.title}</h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </main>
        <SiteFooter language={language} />
      </div>
    </LanguageProvider>
  )
}
