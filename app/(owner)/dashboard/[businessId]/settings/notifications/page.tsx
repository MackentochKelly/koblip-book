import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { getNotificationChoices } from "@/features/notifications/api/queries"
import { NotificationChoices } from "@/features/notifications/components/notification-choices"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications")
  return { title: t("choices.title") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function NotificationSettingsPage({ params }: Props) {
  const { businessId } = await params
  const choices = await getNotificationChoices(businessId)
  if (!choices) notFound()
  return <NotificationChoices businessId={businessId} choices={choices} />
}
