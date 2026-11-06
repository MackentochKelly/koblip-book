import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getMyProfile } from "@/features/team-area/api/queries"
import { ProfileForm } from "@/features/team-area/components/profile-form"
import { requireTeamMember } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teamArea.nav")
  return { title: t("profile") }
}

export default async function MyProfilePage({ params }: PageProps<"/team/[memberId]/profile">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  return (
    <ProfileForm
      teamMemberId={seat.teamMemberId}
      name={seat.name}
      photoUrl={seat.photoUrl}
      publicHref={`/b/${seat.business.slug}/team/${seat.teamMemberId}`}
      profile={await getMyProfile(seat)}
    />
  )
}
