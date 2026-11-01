import type { Metadata } from "next"
import { headers } from "next/headers"

import { HeroCardPage } from "@/components/hero-card-page"
import { teamCalendarWordsFor } from "@/features/team-calendar/i18n"
import { DEFAULT_LANGUAGE, isPageLanguage, PAGE_LANGUAGE_HEADER } from "@/lib/page-language"

export const metadata: Metadata = { robots: { index: false, follow: false } }

const RESULTS = ["connected", "denied", "failed", "expired"] as const

// Where a team member's Google window ends (app/api/google-calendar/callback).
export default async function TeamCalendarDonePage({ searchParams }: PageProps<"/team-calendar/done">) {
  const { result } = await searchParams
  const picked = (await headers()).get(PAGE_LANGUAGE_HEADER)
  const lang = isPageLanguage(picked) ? picked : DEFAULT_LANGUAGE
  const t = teamCalendarWordsFor(lang)
  const words = t[RESULTS.find((value) => value === result) ?? "failed"]
  return (
    <HeroCardPage language={lang} title={words.title}>
      <p className="text-center text-sm text-muted-foreground">{words.text}</p>
    </HeroCardPage>
  )
}
