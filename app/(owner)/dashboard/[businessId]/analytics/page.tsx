import type { Metadata } from "next"
import { getCustomers } from "@/features/dashboard/api/customers"
import {
  getBookingCounts,
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { AnalyticsView } from "@/features/dashboard/components/analytics-view"
import { dashboardSummary } from "@/features/dashboard/utils/analytics"
import { bookingsPerDay } from "@/features/dashboard/utils/bookings-per-day"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { addDaysTo, todayIn } from "@/lib/format-booking-time"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.analytics }
}

export default async function AnalyticsPage({
  params,
}: PageProps<"/dashboard/[businessId]/analytics">) {
  const { businessId } = await params
  const { business } = await getOwnerBusiness(businessId)
  const today = todayIn(business.timezone)
  const from = addDaysTo(today, 1 - BOOKING_RULES.analyticsDays)
  const [upcoming, counts, lastDays, customers] = await Promise.all([
    getBookings(businessId, "upcoming"),
    getBookingCounts(businessId),
    getBookingsBetween(businessId, from, today),
    getCustomers(businessId),
  ])
  return (
    <AnalyticsView
      counts={counts}
      nextDays={bookingsPerDay(upcoming, today, BOOKING_RULES.chartDays)}
      summary={dashboardSummary(lastDays, customers, today)}
      currency={business.currency}
    />
  )
}
