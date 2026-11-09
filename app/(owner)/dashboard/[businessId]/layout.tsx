import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BusinessTheme } from "@/components/business-theme"
import { Toaster } from "@/components/ui/sonner"
import { AssistantFloat } from "@/features/assistant/components/assistant-float"
import {
  getMyBusinesses,
  getOwnerBusiness,
} from "@/features/dashboard/api/queries"
import { DemoBar } from "@/features/dashboard/components/demo-bar"
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { WelcomePanel } from "@/features/dashboard/components/welcome-panel"
import { getUnreadCount } from "@/features/notifications/api/queries"
import { NotificationBell } from "@/features/notifications/components/notification-bell"
import { NotificationsProvider } from "@/features/notifications/components/notifications-provider"
import { VerifyEmailAlert } from "@/features/owner-auth/components/verify-email-alert"
import { requireOwner } from "@/lib/dal"
import { lockedPlans } from "@/lib/plan-access"
import { notificationRules } from "@/lib/platform-settings"
import { DEFAULT_THEME, isAvailableTheme } from "@/lib/theme-rules"

export default async function BusinessDashboardLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]">) {
  const { businessId } = await params
  const owner = await requireOwner(`/dashboard/${businessId}`)
  const { business } = await getOwnerBusiness(businessId)
  const [verify, unread, rules, businesses, locked] = await Promise.all([
    getTranslations("owner.settings.verify"),
    getUnreadCount(),
    notificationRules(),
    getMyBusinesses(),
    // What this business's plan lacks, for the plan badges.
    lockedPlans(businessId),
  ])
  // One bell state for the page; the first count is rendered here, then the
  // bell keeps it current (docs/plans/in-app-notifications.md, N-D3).
  return (
    <NotificationsProvider
      initialUnread={unread}
      pollSeconds={rules.inAppPollSeconds}
      settingsHref={`/dashboard/${businessId}/settings/notifications`}
    >
      {/* This business's look, for as long as its dashboard is open. */}
      <BusinessTheme
        theme={isAvailableTheme(business.theme) ? business.theme : DEFAULT_THEME}
      />
      <DashboardShell
        business={{ id: business.id, slug: business.slug, name: business.name }}
        businesses={businesses}
        owner={{ name: owner.name, contact: owner.contact, image: owner.image }}
        bell={<NotificationBell />}
        lockedPlans={locked}
        assistantFloat={
          !locked.assistantChat ? (
            <AssistantFloat businessId={business.id} />
          ) : undefined
        }
      >
        {owner.isGuest && <DemoBar />}
        {/* A demo guest, or an account made by phone, has no email of its
            own to confirm. */}
        {!owner.emailVerified && !owner.isGuest && owner.email && (
          <VerifyEmailAlert
            email={owner.email}
            labels={{
              title: verify("title"),
              sentTo: verify("sentTo", { email: owner.email }),
              resend: verify("resend"),
              sent: verify("sent"),
              failed: verify("failed"),
            }}
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
