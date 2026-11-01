import type { Metadata } from "next"

import { getMyBookings } from "@/features/team-area/api/queries"
import { MyBookings } from "@/features/team-area/components/my-bookings"
import { teamAreaWordsFor } from "@/features/team-area/i18n"
import { getTeamAreaLanguage } from "@/features/team-area/i18n/server"
import { requireTeamMember } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  return { title: teamAreaWordsFor(await getTeamAreaLanguage()).nav.bookings }
}

export default async function MyBookingsPage({ params }: PageProps<"/team/[memberId]">) {
  const { memberId } = await params
  const { seat } = await requireTeamMember(memberId)
  const [upcoming, past] = await Promise.all([
    getMyBookings(seat, "upcoming"),
    getMyBookings(seat, "past"),
  ])
  return <MyBookings upcoming={upcoming} past={past} timeZone={seat.business.timezone} />
}
