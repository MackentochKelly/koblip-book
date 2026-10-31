import { getAdminNotifications } from "@/features/admin/api/notifications"
import { AdminNotificationsList } from "@/features/admin/components/admin-notifications"
import { notificationFilterFrom } from "@/features/admin/utils/notification-filter"

// Notifications (in-app N6): every stored notification, with filters.
export default async function AdminNotificationsPage({
  searchParams,
}: PageProps<"/admin/notifications">) {
  const filter = notificationFilterFrom(await searchParams)
  const notifications = await getAdminNotifications(filter)
  return <AdminNotificationsList {...notifications} filter={filter} />
}
