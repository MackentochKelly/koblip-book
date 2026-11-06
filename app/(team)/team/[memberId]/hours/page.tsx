import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getMyHours } from "@/features/team-area/api/queries"
import { MyHours } from "@/features/team-area/components/my-hours"
import { requireTeamMember } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teamArea.nav")
  return { title: t("hours") }
}

export default async function MyHoursPage({ params }: PageProps<"/team/[memberId]/hours">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  return <MyHours rows={await getMyHours(seat)} />
}
