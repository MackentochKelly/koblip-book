import Link from "next/link"
import { useFormatter, useLocale, useTranslations } from "next-intl"

import { LanguageMenu } from "@/components/language-menu"
import { LanguageProvider } from "@/components/language-provider"
import { SiteFooter } from "@/components/site-footer"
import { StickyHeader } from "@/components/sticky-header"
import { SiteHeader } from "@/components/site-header"
import { WordsProvider } from "@/components/words-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { LanguagesIcon } from "@/components/ui/icons"
import {
  LEGAL_CONTACT,
  LEGAL_SECTIONS,
  LEGAL_UPDATED,
  type LegalDoc,
} from "@/features/legal/content"
import { languageOf } from "@/lib/page-language"
import { SOURCE_LANGUAGE } from "@/lib/translations/languages"

// One legal page (Privacy or Terms): the home header and footer around a
// short, readable column of sections.
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = useTranslations("public.legal")
  const format = useFormatter()
  const language = languageOf(useLocale())
  const updated = format.dateTime(LEGAL_UPDATED, {
    dateStyle: "long",
    timeZone: "UTC",
  })
  return (
    <WordsProvider namespaces={["app", "public"]}>
      <LanguageProvider language={language}>
        <div className="flex min-h-dvh flex-col bg-background">
          {/* The header stays on top while the page scrolls. */}
          <StickyHeader>
            <SiteHeader floating control={<LanguageMenu />} />
          </StickyHeader>
          <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-8 px-4 pt-32 pb-12">
            {/* Every other language is a translation of the English, which
                is the one that applies (docs/plans/translations.md, G8).
                The page's path is its doc's name (app/(public)/<doc>). */}
            {language !== SOURCE_LANGUAGE && (
              <Alert>
                <LanguagesIcon />
                <AlertDescription>
                  {t("translated")}{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/${doc}?lang=${SOURCE_LANGUAGE}`}
                        hrefLang={SOURCE_LANGUAGE}
                      />
                    }
                  >
                    {t("readEnglish")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-balance">
                {t(`${doc}.title`)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("updated", { date: updated })}
              </p>
            </div>
            {LEGAL_SECTIONS[doc].map((section) => (
              <section key={section.title} className="flex flex-col gap-3">
                <h2 className="text-lg font-medium">{t(section.title)}</h2>
                <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
                  {section.points.map((point) => (
                    <li key={point}>{t(point, { contact: LEGAL_CONTACT })}</li>
                  ))}
                </ul>
              </section>
            ))}
          </main>
          <SiteFooter />
        </div>
      </LanguageProvider>
    </WordsProvider>
  )
}
