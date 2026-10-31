import { Suspense } from "react"

import { Toaster } from "@/components/ui/sonner"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import {
  getOwnerLanguage,
  getOwnerMessages,
} from "@/features/dashboard/i18n/server"
import { WelcomePanel } from "@/features/dashboard/components/welcome-panel"
import { getUnreadCount } from "@/features/notifications/api/queries"
import { NotificationBell } from "@/features/notifications/components/notification-bell"
import { NotificationsProvider } from "@/features/notifications/components/notifications-provider"
import { VerifyEmailAlert } from "@/features/owner-auth/components/verify-email-alert"
import { requireOwner } from "@/lib/dal"
import { notificationRules } from "@/lib/platform-settings"

export default async function BusinessDashboardLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]">) {
  const { businessId } = await params
  const owner = await requireOwner(`/dashboard/${businessId}`)
  const { business } = await getOwnerBusiness(businessId)
  const [verify, language, unread, rules] = await Promise.all([
    getOwnerMessages().then((m) => m.settings.verify),
    getOwnerLanguage(),
    getUnreadCount(),
    notificationRules(),
  ])
  // One bell state for the page; the first count is rendered here, then the
  // bell keeps it current (docs/plans/in-app-notifications.md, N-D3).
  return (
    <NotificationsProvider
      language={language}
      initialUnread={unread}
      pollSeconds={rules.inAppPollSeconds}
      settingsHref={`/dashboard/${businessId}/settings/notifications`}
    >
      <DashboardShell
        business={{ id: business.id, slug: business.slug, name: business.name }}
        owner={{ name: owner.name, email: owner.email, image: owner.image }}
        bell={<NotificationBell />}
      >
        {/* A demo guest has no email of its own to confirm. */}
        {!owner.emailVerified && !owner.isGuest && (
          <VerifyEmailAlert
            email={owner.email}
            labels={{ ...verify, sentTo: verify.sentTo(owner.email) }}
          />
        )}
        {children}
        <Suspense>
          <WelcomePanel slug={business.slug} name={business.name} />
        </Suspense>
        <Toaster />
      </DashboardShell>
    </NotificationsProvider>
  )
}
