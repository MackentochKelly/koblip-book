import type { Metadata } from "next"
import { headers } from "next/headers"

import { Button } from "@/components/ui/button"
import { TeamCalendarPage } from "@/features/team-calendar/components/team-calendar-page"
import { teamCalendarWordsFor } from "@/features/team-calendar/i18n"
import { readGoogleInvite } from "@/lib/google-calendar-invites"
import { DEFAULT_LANGUAGE, isPageLanguage, PAGE_LANGUAGE_HEADER } from "@/lib/page-language"

// Never in search results: a link is one person's key.
export const metadata: Metadata = { robots: { index: false, follow: false } }

async function language() {
  const picked = (await headers()).get(PAGE_LANGUAGE_HEADER)
  return isPageLanguage(picked) ? picked : DEFAULT_LANGUAGE
}

// The page a team member's calendar link opens (G5): who asks, and one
// Connect button, which goes to Google. A used or old link says so.
export default async function TeamCalendarLinkPage({ params }: PageProps<"/team-calendar/[token]">) {
  const { token } = await params
  const lang = await language()
  const t = teamCalendarWordsFor(lang)
  const invite = await readGoogleInvite(token)
  if (!invite || invite.state !== "ready") {
    return (
      <TeamCalendarPage language={lang} title={t.expired.title}>
        <p className="text-center text-sm text-muted-foreground">{t.expired.text}</p>
      </TeamCalendarPage>
    )
  }
  return (
    <TeamCalendarPage language={lang} title={t.title}>
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">{t.intro(invite.businessName)}</p>
        {/* A route that leaves for Google, not a page: a plain link. */}
        <Button
          size="lg"
          nativeButton={false}
          render={<a href={`/api/google-calendar/team?invite=${encodeURIComponent(token)}`} />}
        >
          {t.connect}
        </Button>
      </div>
    </TeamCalendarPage>
  )
}
