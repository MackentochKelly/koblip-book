import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

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
import { businessFeatures, featurePlans } from "@/lib/plan-access"
import type { PlanFeatureKey } from "@/lib/plan-features"
import { notificationRules } from "@/lib/platform-settings"

export default async function BusinessDashboardLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]">) {
  const { businessId } = await params
  const owner = await requireOwner(`/dashboard/${businessId}`)
  const { business } = await getOwnerBusiness(businessId)
  const [verify, unread, rules, businesses, features, plans] = await Promise.all([
    getTranslations("owner.settings.verify"),
    getUnreadCount(),
    notificationRules(),
    getMyBusinesses(),
    businessFeatures(businessId),
    featurePlans(),
  ])
  // What this business's plan lacks, for the menu's plan badges.
  const lockedPlans = Object.fromEntries(
    (Object.keys(features) as PlanFeatureKey[])
      .filter((key) => !features[key])
      .map((key) => [key, plans[key]])
  )
  // One bell state for the page; the first count is rendered here, then the
  // bell keeps it current (docs/plans/in-app-notifications.md, N-D3).
  return (
    <NotificationsProvider
      initialUnread={unread}
      pollSeconds={rules.inAppPollSeconds}
      settingsHref={`/dashboard/${businessId}/settings/notifications`}
    >
      <DashboardShell
        business={{ id: business.id, slug: business.slug, name: business.name }}
        businesses={businesses}
        owner={{ name: owner.name, contact: owner.contact, image: owner.image }}
        bell={<NotificationBell />}
        lockedPlans={lockedPlans}
        assistantFloat={
          features.assistantChat ? (
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
