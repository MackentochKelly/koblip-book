import type { Metadata } from "next"
import {
  getBookingCounts,
  getBookings,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import { getServiceTeams } from "@/features/dashboard/api/team-service-queries"
import { BookingsView } from "@/features/dashboard/components/bookings-view"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { addDaysTo, todayIn } from "@/lib/format-booking-time"

export const metadata: Metadata = { title: "Bookings" }

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function BookingsPage({ params }: Props) {
  const { businessId } = await params
  const [upcoming, past, counts, owner, serviceTeams, addonGroups] =
    await Promise.all([
      getBookings(businessId, "upcoming"),
      getBookings(businessId, "past"),
      getBookingCounts(businessId),
      getOwnerBusiness(businessId),
      getServiceTeams(businessId),
      getAddonGroups(businessId),
    ])
  const { business } = owner
  // Confirmed bookings per day, today and the 13 days after it.
  const today = todayIn(business.timezone)
  const nextDays = Array.from({ length: 14 }, (_, index) => {
    const date = addDaysTo(today, index)
    return {
      date,
      bookings: upcoming.filter(
        (booking) => booking.date === date && booking.status === "confirmed"
      ).length,
    }
  })
  return (
    <BookingsView
      businessId={businessId}
      upcoming={upcoming}
      past={past}
      counts={counts}
      nextDays={nextDays}
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
      }}
      createBooking={createOwnerBooking}
    />
  )
}
