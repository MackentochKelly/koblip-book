import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import { headerButtonClassName } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { XIcon } from "@/components/ui/icons"
import { claimBusiness } from "@/features/dashboard/api/actions"
import { AccountMenu } from "@/features/dashboard/components/account-menu"
import { StartScreen } from "@/features/dashboard/components/start-screen"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { PlanLocked } from "@/components/plan-locked"
import { requireAccount } from "@/lib/dal"
import { ownerHasFeature } from "@/lib/plan-access"
import { languageOf } from "@/lib/page-language"
import { getMyBusinesses } from "@/features/dashboard/api/queries"
import { MyBusinessesCard } from "@/features/dashboard/components/my-businesses-card"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell.businesses")
  return { title: t("add") }
}

// Add business, from the menu's business switcher: the same Google Maps
// search as the first business; picking one opens its setup. Under it, the
// businesses the owner already has. ✕ goes back to the one they had open.
export default async function NewBusinessPage() {
  const owner = await requireAccount("/dashboard/new")
  const [t, locale, businesses, canAdd] = await Promise.all([
    getTranslations("owner.shell.businesses"),
    getLocale(),
    getMyBusinesses(),
    ownerHasFeature(owner.userId, "multipleBusinesses"),
  ])
  const language = languageOf(locale)
  return (
    <StartScreen
      language={language}
      title={t("addTitle")}
      hint={t("addHint")}
      action={
        <AccountMenu
          owner={{ name: owner.name, contact: owner.contact, image: owner.image }}
        />
      }
      close={
        <Button
          variant="outline"
          size="icon"
          aria-label={t("back")}
          title={t("back")}
          className={headerButtonClassName}
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <XIcon />
        </Button>
      }
    >
      {canAdd ? (
        <GetStarted
          signedIn
          claim={claimBusiness}
          hint={false}
          language={language}
        />
      ) : (
        <PlanLocked feature="multipleBusinesses" />
      )}
      {businesses.length > 0 && (
        <MyBusinessesCard
          businesses={businesses}
          labels={{ title: t("yours") }}
        />
      )}
    </StartScreen>
  )
}
