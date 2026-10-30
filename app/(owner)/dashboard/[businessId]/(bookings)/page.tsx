import type { Metadata } from "next"
import {
  getBookingCounts,
  getBookings,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import { getServiceTeams } from "@/features/dashboard/api/team-service-queries"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { BookingsView } from "@/features/dashboard/components/bookings-view"
import { ConfirmDetailsCard } from "@/features/dashboard/components/confirm-details-card"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { moveOwnerBooking } from "@/features/booking/api/move-owner-booking"
import { LiveRefresh } from "@/components/live-refresh"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { addDaysTo, todayIn } from "@/lib/format-booking-time"
import { offersWhatsapp } from "@/lib/whatsapp-offer"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.bookings }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function BookingsPage({ params }: Props) {
  const { businessId } = await params
  const [upcoming, past, counts, owner, serviceTeams, addonGroups, whatsapp] =
    await Promise.all([
      getBookings(businessId, "upcoming"),
      getBookings(businessId, "past"),
      getBookingCounts(businessId),
      getOwnerBusiness(businessId),
      getServiceTeams(businessId),
      getAddonGroups(businessId),
      offersWhatsapp(businessId),
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
  const bookings = (
    <>
      {/* New bookings (from the booking page) show up by themselves. */}
      <LiveRefresh seconds={BOOKING_RULES.ownerRefreshSeconds} />
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
          whatsapp,
        }}
        createBooking={createOwnerBooking}
        moveBooking={moveOwnerBooking}
      />
    </>
  )
  if (business.detailsConfirmedAt !== null) return bookings
  // Until the owner confirms what came from Google Maps, that comes first.
  return (
    <div className="flex flex-col gap-6">
      <ConfirmDetailsCard
        businessId={businessId}
        details={{
          name: business.name,
          category: business.category,
          phone: business.phone,
          address: business.address,
          website: business.website,
          openDays: new Set(owner.hours.map((hour) => hour.weekday)).size,
        }}
      />
      {bookings}
    </div>
  )
}
