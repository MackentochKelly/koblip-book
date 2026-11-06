import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { HeroCardPage } from "@/components/hero-card-page"
import { WordsProvider } from "@/components/words-provider"
import {
  customerBookingToMove,
  moveAvailability,
} from "@/features/booking/api/get-availability"
import { RescheduleForm } from "@/features/booking/components/reschedule-form"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { getCustomer } from "@/lib/customer-dal"
import { languageOf } from "@/lib/page-language"

type Props = PageProps<"/my-bookings/[bookingId]/reschedule">

// The page's language is ?lang=, then the phone's (proxy.ts).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account")
  return { title: t("newTime"), robots: { index: false } }
}

// A new time for one of the signed-in customer's own bookings still ahead.
export default async function ReschedulePage({ params }: Props) {
  const locale = await getLocale()
  const language = languageOf(locale)
  const customer = await getCustomer()
  if (!customer) redirect(myBookingsLoginHref(language))
  const { bookingId } = await params
  const found = await customerBookingToMove(bookingId, customer.phone)
  if (!found) notFound()
  const { business, booking } = found
  const t = await getTranslations("public.account")
  const when = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: business.timezone,
  }).format(new Date(booking.startAt))
  return (
    <WordsProvider namespaces={["app", "public"]}>
      <HeroCardPage language={language} title={t("newTime")}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {business.name} · {booking.serviceName}
            </p>
            <p className="text-sm text-muted-foreground">{t("now", { when })}</p>
          </div>
          <RescheduleForm
            bookingId={booking.id}
            availability={await moveAvailability(business, booking)}
            timeZone={business.timezone}
          />
        </div>
      </HeroCardPage>
    </WordsProvider>
  )
}
