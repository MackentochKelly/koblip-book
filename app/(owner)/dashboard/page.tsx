import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { claimBusiness } from "@/features/dashboard/api/actions"
import { getMyBusinesses } from "@/features/dashboard/api/queries"
import { AccountMenu } from "@/features/dashboard/components/account-menu"
import { StartScreen } from "@/features/dashboard/components/start-screen"
import { LAST_BUSINESS_COOKIE } from "@/features/dashboard/last-business"
import { GetStarted } from "@/features/onboarding/components/get-started"
import { getTeamSeats, requireOwner } from "@/lib/dal"
import { languageOf } from "@/lib/page-language"

// Where every login lands: the business the owner last opened (else their
// first); a team member with no business of their own, their team area
// (docs/plans/team-accounts.md); else one step only: find the business on
// Google Maps (the home page's box).
export default async function DashboardPage() {
  const owner = await requireOwner("/dashboard")
  const [businesses, cookieStore] = await Promise.all([
    getMyBusinesses(),
    cookies(),
  ])
  if (businesses.length) {
    const last = cookieStore.get(LAST_BUSINESS_COOKIE)?.value
    const open = businesses.find((business) => business.id === last)
    redirect(`/dashboard/${(open ?? businesses[0]).id}`)
  }
  // A demo guest whose copy is gone has nothing here: back to the home page.
  if (owner.isGuest) {
    redirect("/")
  }
  const [seat] = await getTeamSeats(owner.userId)
  if (seat) {
    redirect(`/team/${seat.teamMemberId}`)
  }
  const firstName = owner.name.trim().split(/\s+/)[0]
  const t = await getTranslations("owner.shell.start")
  const language = languageOf(await getLocale())
  return (
    <StartScreen
      language={language}
      welcome={firstName ? t("welcome", { name: firstName }) : undefined}
      title={t("title")}
      hint={t("hint")}
      action={
        <AccountMenu
          owner={{ name: owner.name, contact: owner.contact, image: owner.image }}
        />
      }
    >
      <GetStarted
        signedIn
        claim={claimBusiness}
        hint={false}
        language={language}
      />
    </StartScreen>
  )
}
