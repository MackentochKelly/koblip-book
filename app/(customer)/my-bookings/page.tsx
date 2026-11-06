import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { HeroCardPage, HeroPage } from "@/components/hero-card-page"
import { myBookings } from "@/features/customer-account/api/my-bookings"
import { AddPhoneForm } from "@/features/customer-account/components/add-phone-form"
import { MyBookingsList } from "@/features/customer-account/components/my-bookings-list"
import { SignOutButton } from "@/features/customer-account/components/sign-out-button"
import { getSession } from "@/lib/dal"
import { messagesFor } from "@/lib/i18n"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { pickLanguage } from "@/lib/page-language"
import { phoneSignInReady } from "@/lib/phone-sign-in"

// ?lang= wins, then the phone's language, like the business page.
async function pageLanguage(
  searchParams: PageProps<"/my-bookings">["searchParams"]
) {
  const { lang } = await searchParams
  return pickLanguage(lang, (await headers()).get("accept-language"))
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/my-bookings">): Promise<Metadata> {
  const m = messagesFor(await pageLanguage(searchParams))
  return { title: m.account.title, robots: { index: false } }
}

// The signed-in account's bookings at every business: the ones made with
// its phone. Signed out, the one login page; no phone yet, add it first.
// Phones are proved by a code, so the page waits for codes to be sendable.
export default async function MyBookingsPage({
  searchParams,
}: PageProps<"/my-bookings">) {
  if (!phoneSignInReady()) notFound()
  const language = await pageLanguage(searchParams)
  const logIn = myBookingsLoginHref(language)
  const session = await getSession()
  if (!session || session.isGuest) redirect(logIn)
  const m = messagesFor(language)
  if (!session.phone) {
    return (
      <HeroCardPage language={language} title={m.account.addPhone}>
        <AddPhoneForm />
        <SignOutButton next={logIn} />
      </HeroCardPage>
    )
  }
  const { upcoming, past } = await myBookings(session.phone, m.locale)
  return (
    <HeroPage language={language} title={m.account.hello(session.name)} wide>
      <MyBookingsList
        upcoming={upcoming}
        past={past}
        language={language}
        m={m}
      />
      <SignOutButton next={logIn} />
    </HeroPage>
  )
}
