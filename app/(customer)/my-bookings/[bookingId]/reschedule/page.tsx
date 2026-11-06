import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { HeroCardPage } from "@/components/hero-card-page"
import {
  customerBookingToMove,
  moveAvailability,
} from "@/features/booking/api/get-availability"
import { RescheduleForm } from "@/features/booking/components/reschedule-form"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { getCustomer } from "@/lib/customer-dal"
import { messagesFor } from "@/lib/i18n"
import { pickLanguage } from "@/lib/page-language"

type Props = PageProps<"/my-bookings/[bookingId]/reschedule">

async function pageLanguage(searchParams: Props["searchParams"]) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const m = messagesFor(await pageLanguage(searchParams))
  return { title: m.account.newTime, robots: { index: false } }
}

// A new time for one of the signed-in customer's own bookings still ahead.
export default async function ReschedulePage({ params, searchParams }: Props) {
  const language = await pageLanguage(searchParams)
  const customer = await getCustomer()
  if (!customer) redirect(myBookingsLoginHref(language))
  const { bookingId } = await params
  const found = await customerBookingToMove(bookingId, customer.phone)
  if (!found) notFound()
  const { business, booking } = found
  const m = messagesFor(language)
  const when = new Intl.DateTimeFormat(m.locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: business.timezone,
  }).format(new Date(booking.startAt))
  return (
    <HeroCardPage language={language} title={m.account.newTime}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {business.name} · {booking.serviceName}
          </p>
          <p className="text-sm text-muted-foreground">{m.account.now(when)}</p>
        </div>
        <RescheduleForm
          bookingId={booking.id}
          availability={await moveAvailability(business, booking)}
          timeZone={business.timezone}
        />
      </div>
    </HeroCardPage>
  )
}
