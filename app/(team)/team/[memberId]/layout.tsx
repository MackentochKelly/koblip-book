import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"
import { WordsProvider } from "@/components/words-provider"
import { TeamShell } from "@/features/team-area/components/team-shell"
import { requireTeamMember } from "@/lib/dal"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// A team member's own area (docs/plans/team-accounts.md): only the account
// that joined as this team member gets in. It speaks the language proxy.ts
// picked for the page (the one picked on this device, else the phone's),
// like the owner area.
export default async function TeamAreaLayout({
  params,
  children,
}: LayoutProps<"/team/[memberId]">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  return (
    <WordsProvider namespaces={["app", "notifications", "owner", "teamArea"]}>
      <TeamShell teamMemberId={seat.teamMemberId} businessName={seat.business.name}>
        {children}
      </TeamShell>
      <Toaster />
    </WordsProvider>
  )
}
