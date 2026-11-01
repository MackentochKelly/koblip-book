import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"
import { TeamShell } from "@/features/team-area/components/team-shell"
import { TeamAreaLanguageProvider } from "@/features/team-area/i18n/provider"
import {
  getTeamAreaLanguage,
  getTeamAreaLocale,
} from "@/features/team-area/i18n/server"
import { requireTeamMember } from "@/lib/dal"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// A team member's own area (docs/plans/team-accounts.md): only the account
// that joined as this team member gets in.
export default async function TeamAreaLayout({
  params,
  children,
}: LayoutProps<"/team/[memberId]">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  const [language, locale] = await Promise.all([
    getTeamAreaLanguage(),
    getTeamAreaLocale(),
  ])
  return (
    <TeamAreaLanguageProvider language={language} locale={locale}>
      <TeamShell teamMemberId={seat.teamMemberId} businessName={seat.business.name}>
        {children}
      </TeamShell>
      <Toaster />
    </TeamAreaLanguageProvider>
  )
}
