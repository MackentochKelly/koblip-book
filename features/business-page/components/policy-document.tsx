import Link from "next/link"
import { LanguageMenu } from "@/components/language-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/icons"
import { messagesFor } from "@/lib/i18n"
import type { PageLanguage } from "@/lib/page-language"
import type { BusinessPolicy } from "../api/get-business-policy"

// One of a business's policies on its own page: a way back to the business,
// the title, when it last changed, and the text in a readable column. The
// text is plain; a blank line starts a new paragraph.
export function PolicyDocument({
  policy,
  language,
}: {
  policy: BusinessPolicy
  language: PageLanguage
}) {
  const m = messagesFor(language)
  const updated = new Date(policy.updatedAt).toLocaleDateString(m.locale, {
    dateStyle: "long",
    timeZone: "UTC",
  })
  const paragraphs = policy.body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <main
      lang={language}
      className="mx-auto flex w-full max-w-prose flex-col gap-8 px-4 pt-4 pb-12 md:pt-8"
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          // Buttons never shrink by default; this one gives way so a long
          // business name truncates instead of widening the page.
          className="-ml-2.5 min-w-0 shrink"
          nativeButton={false}
          render={<Link href={`/b/${policy.business.slug}?lang=${language}`} />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          <span className="truncate">{m.policies.backTo(policy.business.name)}</span>
        </Button>
        <div className="flex shrink-0 gap-2">
          <ThemeToggle />
          <LanguageMenu />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {policy.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {m.policies.updated}: {updated}
        </p>
      </div>
      <div className="flex flex-col gap-4 whitespace-pre-line text-muted-foreground">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </main>
  )
}
