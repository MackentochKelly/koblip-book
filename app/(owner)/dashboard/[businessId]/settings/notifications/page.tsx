import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getOwnerLanguage,
  getOwnerMessages,
} from "@/features/dashboard/i18n/server"
import { getNotificationChoices } from "@/features/notifications/api/queries"
import { NotificationChoices } from "@/features/notifications/components/notification-choices"
import { notificationMessagesFor } from "@/features/notifications/i18n"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: notificationMessagesFor(await getOwnerLanguage()).choices.title,
  }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function NotificationSettingsPage({ params }: Props) {
  const { businessId } = await params
  const [choices, language, m] = await Promise.all([
    getNotificationChoices(businessId),
    getOwnerLanguage(),
    getOwnerMessages(),
  ])
  if (!choices) notFound()
  return (
    <NotificationChoices
      businessId={businessId}
      language={language}
      choices={choices}
      back={{
        href: `/dashboard/${businessId}/settings`,
        label: m.shell.nav.settings,
      }}
    />
  )
}
