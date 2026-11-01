import type { Metadata } from "next"

import { getMyHours } from "@/features/team-area/api/queries"
import { MyHours } from "@/features/team-area/components/my-hours"
import { teamAreaWordsFor } from "@/features/team-area/i18n"
import { getTeamAreaLanguage } from "@/features/team-area/i18n/server"
import { requireTeamMember } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  return { title: teamAreaWordsFor(await getTeamAreaLanguage()).nav.hours }
}

export default async function MyHoursPage({ params }: PageProps<"/team/[memberId]/hours">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  return <MyHours rows={await getMyHours(seat)} />
}
