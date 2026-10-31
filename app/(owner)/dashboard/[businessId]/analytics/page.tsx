import type { Metadata } from "next"
import { getFirstVisits } from "@/features/dashboard/api/customers"
import {
  getBookingCounts,
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { AnalyticsView } from "@/features/dashboard/components/analytics-view"
import {
  type Period,
  PERIODS,
  type PeriodSummary,
  periodSummary,
} from "@/features/dashboard/utils/analytics"
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
  // The longest period and the one before it, so each can be compared.
  const longest = Math.max(...PERIODS)
  const [upcoming, counts, past] = await Promise.all([
    getBookings(businessId, "upcoming"),
    getBookingCounts(businessId),
    getBookingsBetween(businessId, addDaysTo(today, 1 - 2 * longest), today),
  ])
  const firstVisits = await getFirstVisits(
    businessId,
    past.map((booking) => booking.customerKey)
  )
  const periods = Object.fromEntries(
    PERIODS.map((days) => [days, periodSummary(past, firstVisits, today, days)])
  ) as Record<Period, PeriodSummary>
  return (
    <AnalyticsView
      periods={periods}
      currency={business.currency}
      comingUp={{
        today: counts.today,
        upcoming: counts.upcoming,
        days: bookingsPerDay(upcoming, today, BOOKING_RULES.chartDays),
      }}
    />
  )
}
