import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getMyBookings } from "@/features/team-area/api/queries"
import { MyBookings } from "@/features/team-area/components/my-bookings"
import { requireTeamMember } from "@/lib/dal"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teamArea.nav")
  return { title: t("bookings") }
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
