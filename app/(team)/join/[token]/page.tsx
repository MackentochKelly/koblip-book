import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroCardPage } from "@/components/hero-card-page"
import { Button } from "@/components/ui/button"
import { WordsProvider } from "@/components/words-provider"
import { JoinButton } from "@/features/team-area/components/join-button"
import { loginHref } from "@/lib/auth-links"
import { getSession } from "@/lib/dal"
import { languageOf } from "@/lib/page-language"
import { readTeamInvite } from "@/lib/team-invites"

// Never in search results: a link is one person's key.
export async function generateMetadata({ params }: PageProps<"/join/[token]">): Promise<Metadata> {
  const { token } = await params
  const [t, invite] = await Promise.all([getTranslations("teamArea.join"), readTeamInvite(token)])
  return {
    title: invite?.state === "ready" ? t("title", { business: invite.businessName }) : t("expired.title"),
    robots: { index: false, follow: false },
  }
}

// The page a team member's invite link opens (docs/plans/team-accounts.md):
// who invites them, then Join, or Log in first (the login page also makes
// an account). A used or old link says so.
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params
  const [locale, t, invite, session] = await Promise.all([
    getLocale(),
    getTranslations("teamArea.join"),
    readTeamInvite(token),
    getSession(),
  ])
  const language = languageOf(locale)
  if (!invite || invite.state !== "ready") {
    return (
      <HeroCardPage language={language} title={t("expired.title")}>
        <p className="text-center text-sm text-muted-foreground">{t("expired.text")}</p>
      </HeroCardPage>
    )
  }
  const signedIn = session && !session.isGuest
  return (
    <HeroCardPage language={language} title={t("title", { business: invite.businessName })}>
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          {signedIn
            ? t("signedInAs", { email: session.contact })
            : t("intro", { name: invite.memberName })}
        </p>
        {signedIn ? (
          <WordsProvider namespaces={["app", "teamArea"]}>
            <JoinButton token={token} />
          </WordsProvider>
        ) : (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={loginHref({ next: `/join/${token}` })} />}
          >
            {t("logIn")}
          </Button>
        )}
      </div>
    </HeroCardPage>
  )
}
