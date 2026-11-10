import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroCardPage } from "@/components/hero-card-page"
import { Button } from "@/components/ui/button"
import { prepareBusiness } from "@/features/onboarding/api/prepare-actions"
import { signUpHref } from "@/features/onboarding/utils/sign-up-link"
import { findInviteByCode } from "@/features/partners/api/invites"
import { StartButton } from "@/features/partners/components/start-button"
import { languageOf } from "@/lib/page-language"
import { noteInviteOpened } from "@/lib/partner-events"

// Never in search results: a link is one business's key.
export const metadata: Metadata = { robots: { index: false, follow: false } }

// The page a partner app's invite link opens (docs/plans/sales-connection.md,
// SC3, SC4). Opening it changes nothing, so a chat app's link preview
// doesn't count: the one button imports the business from Google, the
// same import the home page uses, and opens the sign-up page with it. A
// claimed invite opens its business's page; an ended one says so.
export default async function StartPage({ params }: PageProps<"/start/[code]">) {
  const { code } = await params
  const [locale, t, invite] = await Promise.all([
    getLocale(),
    getTranslations("public.partnerStart"),
    findInviteByCode(code),
  ])
  const language = languageOf(locale)
  if (invite.state === "claimed") redirect(invite.slug ? `/b/${invite.slug}` : "/")
  if (invite.state === "ended") {
    return (
      <HeroCardPage language={language} title={t("ended.title")}>
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">{t("ended.text")}</p>
          <Button size="lg" nativeButton={false} render={<Link href="/" />}>
            {t("ended.action")}
          </Button>
        </div>
      </HeroCardPage>
    )
  }

  async function start(): Promise<{ ok: false }> {
    "use server"
    const now = await findInviteByCode(code)
    if (now.state === "claimed") redirect(now.slug ? `/b/${now.slug}` : "/")
    if (now.state !== "open") return { ok: false }
    const prepared = await prepareBusiness({ placeId: now.placeId })
    if (!prepared.ok) return { ok: false }
    await noteInviteOpened(now.id, prepared.slug)
    redirect(
      signUpHref(
        { name: prepared.name, address: prepared.address, slug: prepared.slug },
        { language }
      )
    )
  }

  return (
    <HeroCardPage language={language} title={t("title")}>
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">{t("text")}</p>
        <StartButton start={start} label={t("start")} failed={t("failed")} />
      </div>
    </HeroCardPage>
  )
}
