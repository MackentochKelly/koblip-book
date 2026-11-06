import type { Metadata } from "next"
import { getFirstVisits } from "@/features/dashboard/api/customers"
import {
  getBookingCounts,
  getBookings,
  getBookingsBetween,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { getWidgetLayout } from "@/features/dashboard/api/widgets"
import { WIDGET_LIST_LIMIT } from "@/features/dashboard/widgets"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import {
  getBusinessPhotos,
  getServiceTeams,
} from "@/features/dashboard/api/team-service-queries"
import {
  getOwnerLanguage,
  getOwnerMessages,
} from "@/features/dashboard/i18n/server"
import { AskCard } from "@/features/assistant/components/ask-card"
import { BookingsView } from "@/features/dashboard/components/bookings-view"
import { periodSummary } from "@/features/dashboard/utils/analytics"
import { bookingsPerDay } from "@/features/dashboard/utils/bookings-per-day"
import { newCustomers } from "@/features/dashboard/utils/new-customers"
import { partOfDay } from "@/features/dashboard/utils/part-of-day"
import { SetupList } from "@/features/dashboard/components/setup-list"
import { setupTasks } from "@/features/dashboard/utils/setup-tasks"
import { createOwnerBooking } from "@/features/booking/api/create-owner-booking"
import { moveOwnerBooking } from "@/features/booking/api/move-owner-booking"
import {
  findMoveFreeTimes,
  findOwnerFreeTimes,
} from "@/features/booking/api/owner-free-times"
import { LiveRefresh } from "@/components/live-refresh"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { addDaysTo, todayIn } from "@/lib/format-booking-time"
import { offersWhatsapp } from "@/lib/whatsapp-offer"
import { requireOwner } from "@/lib/dal"

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
  const [
    upcoming,
    past,
    lastDays,
    serviceTeams,
    addonGroups,
    whatsapp,
    counts,
    widgetLayout,
    photos,
  ] = await Promise.all([
    getBookings(businessId, "upcoming"),
    getBookings(businessId, "past"),
    // The last 7 days and the 7 before, for the numbers on top.
    getBookingsBetween(businessId, addDaysTo(today, -13), today),
    getServiceTeams(businessId),
    getAddonGroups(businessId),
    offersWhatsapp(businessId),
    getBookingCounts(businessId),
    getWidgetLayout(business),
    getBusinessPhotos(businessId),
  ])
  const firstVisits = await getFirstVisits(
    businessId,
    lastDays.map((booking) => booking.customerKey)
  )
  const now = new Date().toISOString()
  const session = await requireOwner()
  const firstName = session.isGuest
    ? undefined
    : session.name.trim().split(/\s+/)[0] || undefined
  const words = (await getOwnerMessages()).shell.greeting
  const greeting =
    words[partOfDay(business.timezone, words.eveningFrom)](firstName)
  const openDays = new Set(owner.hours.map((hour) => hour.weekday)).size
  const confirmed = business.detailsConfirmedAt !== null
  const steps = setupTasks(
    {
      detailsConfirmed: confirmed,
      openDays,
      services: owner.services.length,
      team: owner.team.length,
      photos: photos.length,
      bookings: upcoming.length + past.length,
    },
    `/dashboard/${businessId}`,
    `/b/${business.slug}`
  )
  const settingUp = steps.some((step) => !step.done)
  return (
    <>
      {/* New bookings (from the booking page) show up by themselves. */}
      <LiveRefresh seconds={BOOKING_RULES.ownerRefreshSeconds} />
      <BookingsView
        businessId={businessId}
        upcoming={upcoming}
        past={past}
        now={now}
        greeting={greeting}
        // The first steps come first until they are all done. (Sign-up's
        // Check your details step confirms what came from Google Maps.)
        setup={settingUp ? <SetupList steps={steps} /> : undefined}
        assistant={
          <AskCard
            businessId={businessId}
            language={await getOwnerLanguage()}
          />
        }
        summary={periodSummary(lastDays, firstVisits, today, 7, now)}
        widgets={{
          ...widgetLayout,
          comingUp: {
            today: counts.today,
            upcoming: counts.upcoming,
            days: bookingsPerDay(upcoming, today, BOOKING_RULES.chartDays),
          },
          // First visits in the last 7 days, like the numbers on top.
          newCustomers: newCustomers(
            lastDays.filter((booking) => booking.date > addDaysTo(today, -7)),
            firstVisits,
            WIDGET_LIST_LIMIT
          ),
          page: { slug: business.slug, name: business.name },
        }}
        currency={business.currency}
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
