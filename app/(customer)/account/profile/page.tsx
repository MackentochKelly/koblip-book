import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { parsePhoneNumberFromString } from "libphonenumber-js"
import { redirect } from "next/navigation"

import { ProfileForm } from "@/features/customer-account/components/profile-form"
import { getSession } from "@/lib/dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"
import { phoneSignInReady } from "@/lib/phone-sign-in"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account.nav")
  return { title: t("profile") }
}

// The client's own name, photo, email and phone.
export default async function AccountProfilePage() {
  const session = await getSession()
  if (!session || session.isGuest) {
    redirect(myBookingsLoginHref(await getOwnerLanguage()))
  }
  return (
    <ProfileForm
      name={session.name}
      photoUrl={session.image}
      email={session.email}
      phone={
        session.phone &&
        (parsePhoneNumberFromString(session.phone)?.formatInternational() ??
          session.phone)
      }
      phoneCodes={phoneSignInReady()}
    />
  )
}
