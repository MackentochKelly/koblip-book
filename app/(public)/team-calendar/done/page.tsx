import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroCardPage } from "@/components/hero-card-page"
import { languageOf } from "@/lib/page-language"

export const metadata: Metadata = { robots: { index: false, follow: false } }

const RESULTS = ["connected", "denied", "failed", "expired"] as const

// Where a team member's Google window ends (app/api/google-calendar/callback).
export default async function TeamCalendarDonePage({ searchParams }: PageProps<"/team-calendar/done">) {
  const { result } = await searchParams
  const lang = languageOf(await getLocale())
  const t = await getTranslations("teamCalendar")
  const shown = RESULTS.find((value) => value === result) ?? "failed"
  return (
    <HeroCardPage language={lang} title={t(`${shown}.title`)}>
      <p className="text-center text-sm text-muted-foreground">{t(`${shown}.text`)}</p>
    </HeroCardPage>
  )
}
