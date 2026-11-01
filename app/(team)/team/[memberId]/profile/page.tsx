import type { Metadata } from "next"

import { getMyProfile } from "@/features/team-area/api/queries"
import { ProfileForm } from "@/features/team-area/components/profile-form"
import { teamAreaWordsFor } from "@/features/team-area/i18n"
import { getTeamAreaLanguage } from "@/features/team-area/i18n/server"
import { requireTeamMember } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  return { title: teamAreaWordsFor(await getTeamAreaLanguage()).nav.profile }
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
