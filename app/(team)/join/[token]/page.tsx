import type { Metadata } from "next"
import Link from "next/link"

import { HeroCardPage } from "@/components/hero-card-page"
import { Button } from "@/components/ui/button"
import { JoinButton } from "@/features/team-area/components/join-button"
import { teamAreaWordsFor } from "@/features/team-area/i18n"
import { TeamAreaLanguageProvider } from "@/features/team-area/i18n/provider"
import {
  getTeamAreaLanguage,
  getTeamAreaLocale,
} from "@/features/team-area/i18n/server"
import { getSession } from "@/lib/dal"
import { readTeamInvite } from "@/lib/team-invites"

// Never in search results: a link is one person's key.
export async function generateMetadata({ params }: PageProps<"/join/[token]">): Promise<Metadata> {
  const { token } = await params
  const [language, invite] = await Promise.all([getTeamAreaLanguage(), readTeamInvite(token)])
  const t = teamAreaWordsFor(language).join
  return {
    title: invite?.state === "ready" ? t.title(invite.businessName) : t.expired.title,
    robots: { index: false, follow: false },
  }
}

// The page a team member's invite link opens (docs/plans/team-accounts.md):
// who invites them, then Join, or Log in first (the login page also makes
// an account). A used or old link says so.
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params
  const [language, locale, invite, session] = await Promise.all([
    getTeamAreaLanguage(),
    getTeamAreaLocale(),
    readTeamInvite(token),
    getSession(),
  ])
  const t = teamAreaWordsFor(language).join
  if (!invite || invite.state !== "ready") {
    return (
      <HeroCardPage language={language} title={t.expired.title}>
        <p className="text-center text-sm text-muted-foreground">{t.expired.text}</p>
      </HeroCardPage>
    )
  }
  const signedIn = session && !session.isGuest
  return (
    <HeroCardPage language={language} title={t.title(invite.businessName)}>
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          {signedIn ? t.signedInAs(session.email) : t.intro(invite.memberName)}
        </p>
        {signedIn ? (
          <TeamAreaLanguageProvider language={language} locale={locale}>
            <JoinButton token={token} />
          </TeamAreaLanguageProvider>
        ) : (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`} />}
          >
            {t.logIn}
          </Button>
        )}
      </div>
    </HeroCardPage>
  )
}
