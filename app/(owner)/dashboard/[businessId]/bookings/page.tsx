import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LiveRefresh } from "@/components/live-refresh"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { moveOwnerBooking } from "@/features/booking/api/move-owner-booking"
import {
  findMoveFreeTimes,
  findOwnerFreeTimes,
} from "@/features/booking/api/owner-free-times"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import {
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getServiceTeams } from "@/features/dashboard/api/team-service-queries"
import { BookingsPageView } from "@/features/dashboard/components/bookings-page-view"
import {
  monthFrom,
  monthRange,
  rangeFrom,
} from "@/features/dashboard/utils/booking-range"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { todayIn } from "@/lib/format-booking-time"
import { teamColorOf } from "@/lib/team-rules"
import { offersWhatsapp } from "@/lib/whatsapp-offer"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.bookings") }
}

export default async function AllBookingsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/bookings">) {
  const { businessId } = await params
  const query = await searchParams
  const owner = await getOwnerBusiness(businessId)
  const { business } = owner
  const today = todayIn(business.timezone)
  const tab = query.view === "calendar" ? "calendar" : "bookings"
  const range = rangeFrom(query.from, query.to, today)
  const month = monthFrom(query.month, today)
  const shown = tab === "calendar" ? monthRange(month) : range
  const [bookings, serviceTeams, addonGroups, whatsapp] = await Promise.all([
    getBookingsBetween(businessId, shown.from, shown.to),
    getServiceTeams(businessId),
    getAddonGroups(businessId),
    offersWhatsapp(businessId),
  ])
  return (
    <>
      <LiveRefresh seconds={BOOKING_RULES.ownerRefreshSeconds} />
      <BookingsPageView
        tab={tab}
        bookings={bookings}
        range={range}
        month={month}
        today={today}
        now={new Date().toISOString()}
        businessId={businessId}
        teamColors={Object.fromEntries(
          owner.team.map((member, index) => [
            member.id,
            teamColorOf(member.calendarColor, index),
          ])
        )}
        addOptions={{
          services: owner.services.map(
            ({ id, name, durationMinutes, categoryId }) => ({
              id,
              name,
              durationMinutes,
              categoryId,
            })
          ),
          categories: owner.categories,
          team: owner.team.map(({ id, name }) => ({ id, name })),
          serviceTeams,
          addonGroups,
          today,
          whatsapp,
        }}
        createBooking={createOwnerBooking}
        findFreeTimes={findOwnerFreeTimes}
        findMoveFreeTimes={findMoveFreeTimes}
        moveBooking={moveOwnerBooking}
      />
    </>
  )
}
