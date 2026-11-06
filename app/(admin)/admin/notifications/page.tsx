import { getClientReminders } from "@/features/admin/api/client-reminders"
import { getAdminNotifications } from "@/features/admin/api/notifications"
import { AdminNotificationsList } from "@/features/admin/components/admin-notifications"
import { ClientReminders } from "@/features/admin/components/client-reminders"
import { notificationFilterFrom } from "@/features/admin/utils/notification-filter"

// Notifications (in-app N6): every stored notification, with filters; then
// how clients get their reminders and every reminder email (client account
// D16).
export default async function AdminNotificationsPage({
  searchParams,
}: PageProps<"/admin/notifications">) {
  const filter = notificationFilterFrom(await searchParams)
  const [notifications, reminders] = await Promise.all([
    getAdminNotifications(filter),
    getClientReminders(),
  ])
  return (
    <div className="flex flex-col gap-10">
      <AdminNotificationsList {...notifications} filter={filter} />
      <ClientReminders {...reminders} />
    </div>
  )
}
