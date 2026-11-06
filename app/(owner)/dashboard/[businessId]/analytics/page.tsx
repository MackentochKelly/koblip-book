import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getFirstVisits } from "@/features/dashboard/api/customers"
import {
  getBookingCounts,
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { AnalyticsView } from "@/features/dashboard/components/analytics-view"
import {
  type Period,
  PERIODS,
  type PeriodSummary,
  periodSummary,
} from "@/features/dashboard/utils/analytics"
import { bookingsPerDay } from "@/features/dashboard/utils/bookings-per-day"
import type { OwnerBooking } from "@/features/dashboard/types"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { addDaysTo, todayIn } from "@/lib/format-booking-time"
import { PlanLocked } from "@/components/plan-locked"
import { hasFeature } from "@/lib/plan-access"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.analytics") }
}

export default async function AnalyticsPage({
  params,
}: PageProps<"/dashboard/[businessId]/analytics">) {
  const { businessId } = await params
  const { business, services, categories } = await getOwnerBusiness(businessId)
  if (!(await hasFeature(businessId, "analytics"))) {
    return <PlanLocked feature="analytics" />
  }
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
  const now = new Date().toISOString()
  // Top categories once there are categories: a booking counts in its
  // service's category, or Other with none or a service since removed.
  const other = (await getTranslations("owner.catalog.categories"))("other")
  const categoryName = new Map(categories.map(({ id, name }) => [id, name]))
  const serviceCategory = new Map(
    services.map(({ id, categoryId }) => [
      id,
      categoryId ? categoryName.get(categoryId) : undefined,
    ])
  )
  const categoryOf =
    categories.length > 0
      ? (booking: OwnerBooking) =>
          (booking.serviceId && serviceCategory.get(booking.serviceId)) || other
      : undefined
  const periods = Object.fromEntries(
    PERIODS.map((days) => [
      days,
      periodSummary(past, firstVisits, today, days, now, categoryOf),
    ])
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
