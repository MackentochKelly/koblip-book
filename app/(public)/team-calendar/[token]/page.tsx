import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { HeroCardPage } from "@/components/hero-card-page"
import { readGoogleInvite } from "@/lib/google-calendar-invites"
import { languageOf } from "@/lib/page-language"

// Never in search results: a link is one person's key.
export const metadata: Metadata = { robots: { index: false, follow: false } }

// The page a team member's calendar link opens (G5): who asks, and one
// Connect button, which goes to Google. A used or old link says so.
export default async function TeamCalendarLinkPage({ params }: PageProps<"/team-calendar/[token]">) {
  const { token } = await params
  const lang = languageOf(await getLocale())
  const t = await getTranslations("teamCalendar")
  const invite = await readGoogleInvite(token)
  if (!invite || invite.state !== "ready") {
    return (
      <HeroCardPage language={lang} title={t("expired.title")}>
        <p className="text-center text-sm text-muted-foreground">{t("expired.text")}</p>
      </HeroCardPage>
    )
  }
  return (
    <HeroCardPage language={lang} title={t("title")}>
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">{t("intro", { business: invite.businessName })}</p>
        {/* A route that leaves for Google, not a page: a plain link. */}
        <Button
          size="lg"
          nativeButton={false}
          render={<a href={`/api/google-calendar/team?invite=${encodeURIComponent(token)}`} />}
        >
          {t("connect")}
        </Button>
      </div>
    </HeroCardPage>
  )
}
