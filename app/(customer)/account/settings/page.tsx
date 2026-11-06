import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { SettingsForm } from "@/features/customer-account/components/settings-form"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { getSession } from "@/lib/dal"
import { myBookingsLoginHref } from "@/lib/my-bookings-links"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.account.nav")
  return { title: t("settings") }
}

// The client's look, language, log out and delete account.
export default async function AccountSettingsPage() {
  const session = await getSession()
  if (!session || session.isGuest) {
    redirect(myBookingsLoginHref(await getOwnerLanguage()))
  }
  return <SettingsForm contact={session.contact} />
}
