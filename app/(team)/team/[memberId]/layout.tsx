import type { Metadata } from "next"

import { BusinessTheme } from "@/components/business-theme"
import { Toaster } from "@/components/ui/sonner"
import { WordsProvider } from "@/components/words-provider"
import { TeamShell } from "@/features/team-area/components/team-shell"
import { PlanLocked } from "@/components/plan-locked"
import { getBusinessThemeById } from "@/lib/business-theme"
import { requireTeamMember } from "@/lib/dal"
import { hasFeature } from "@/lib/plan-access"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// A team member's own area (docs/plans/team-accounts.md): only the account
// that joined as this team member gets in. It speaks the language proxy.ts
// picked for the page (the one picked on this device, else the phone's),
// like the owner area. A plan without team accounts locks it.
export default async function TeamAreaLayout({
  params,
  children,
}: LayoutProps<"/team/[memberId]">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  // The business's plan no longer has team accounts: the area stays, locked,
  // until it does again (S7).
  const [open, theme] = await Promise.all([
    hasFeature(seat.business.id, "teamAccounts"),
    getBusinessThemeById(seat.business.id),
  ])
  return (
    <WordsProvider namespaces={["app", "notifications", "owner", "teamArea"]}>
      <BusinessTheme theme={theme} />
      <TeamShell teamMemberId={seat.teamMemberId} businessName={seat.business.name}>
        {open ? children : <PlanLocked feature="teamAccounts" />}
      </TeamShell>
      <Toaster />
    </WordsProvider>
  )
}
