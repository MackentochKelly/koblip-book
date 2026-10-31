import type { Metadata } from "next"
import { LiveRefresh } from "@/components/live-refresh"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { moveOwnerBooking } from "@/features/booking/api/move-owner-booking"
import { findOwnerFreeTimes } from "@/features/booking/api/owner-free-times"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import {
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getServiceTeams } from "@/features/dashboard/api/team-service-queries"
import { BookingsPageView } from "@/features/dashboard/components/bookings-page-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import {
  monthFrom,
  monthRange,
  rangeFrom,
} from "@/features/dashboard/utils/booking-range"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { todayIn } from "@/lib/format-booking-time"
import { offersWhatsapp } from "@/lib/whatsapp-offer"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.bookings }
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
        addOptions={{
          services: owner.services.map(({ id, name, durationMinutes }) => ({
            id,
            name,
            durationMinutes,
          })),
          team: owner.team.map(({ id, name }) => ({ id, name })),
          serviceTeams,
          addonGroups,
          today,
          whatsapp,
        }}
        createBooking={createOwnerBooking}
        findFreeTimes={findOwnerFreeTimes}
        moveBooking={moveOwnerBooking}
      />
    </>
  )
}
