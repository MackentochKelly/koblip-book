import type { Metadata } from "next"
import {
  getBookingCounts,
  getBookings,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { AnalyticsView } from "@/features/dashboard/components/analytics-view"
import { bookingsPerDay } from "@/features/dashboard/utils/bookings-per-day"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { todayIn } from "@/lib/format-booking-time"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.analytics }
}

export default async function AnalyticsPage({
  params,
}: PageProps<"/dashboard/[businessId]/analytics">) {
  const { businessId } = await params
  const [upcoming, counts, { business }] = await Promise.all([
    getBookings(businessId, "upcoming"),
    getBookingCounts(businessId),
    getOwnerBusiness(businessId),
  ])
  return (
    <AnalyticsView
      counts={counts}
      nextDays={bookingsPerDay(
        upcoming,
        todayIn(business.timezone),
        BOOKING_RULES.chartDays
      )}
    />
  )
}
