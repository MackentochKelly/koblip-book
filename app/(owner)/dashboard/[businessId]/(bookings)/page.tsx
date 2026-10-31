import type { Metadata } from "next"
import { getCustomers } from "@/features/dashboard/api/customers"
import {
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import { getServiceTeams } from "@/features/dashboard/api/team-service-queries"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { BookingsView } from "@/features/dashboard/components/bookings-view"
import { dashboardSummary } from "@/features/dashboard/utils/analytics"
import { ConfirmDetailsCard } from "@/features/dashboard/components/confirm-details-card"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { moveOwnerBooking } from "@/features/booking/api/move-owner-booking"
import { LiveRefresh } from "@/components/live-refresh"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { addDaysTo, todayIn } from "@/lib/format-booking-time"
import { offersWhatsapp } from "@/lib/whatsapp-offer"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.dashboard }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function BookingsPage({ params }: Props) {
  const { businessId } = await params
  const owner = await getOwnerBusiness(businessId)
  const { business } = owner
  const today = todayIn(business.timezone)
  const [upcoming, past, lastDays, customers, serviceTeams, addonGroups, whatsapp] =
    await Promise.all([
      getBookings(businessId, "upcoming"),
      getBookings(businessId, "past"),
      getBookingsBetween(
        businessId,
        addDaysTo(today, 1 - BOOKING_RULES.analyticsDays),
        today
      ),
      getCustomers(businessId),
      getServiceTeams(businessId),
      getAddonGroups(businessId),
      offersWhatsapp(businessId),
    ])
  const bookings = (
    <>
      {/* New bookings (from the booking page) show up by themselves. */}
      <LiveRefresh seconds={BOOKING_RULES.ownerRefreshSeconds} />
      <BookingsView
        businessId={businessId}
        upcoming={upcoming}
        past={past}
        summary={dashboardSummary(lastDays, customers, today)}
        currency={business.currency}
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
