import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { OwnerLanguageProvider } from "@/components/app-language"
import { Toaster } from "@/components/ui/sonner"
import { WordsProvider } from "@/components/words-provider"
import { AccountShell } from "@/features/customer-account/components/account-shell"
import { getOwnerLanguage } from "@/features/dashboard/i18n/server"
import { getClientUnreadCount } from "@/features/notifications/api/client-queries"
import { NotificationBell } from "@/features/notifications/components/notification-bell"
import { NotificationsProvider } from "@/features/notifications/components/notifications-provider"
import { notificationRules } from "@/lib/platform-settings"
import { eq } from "drizzle-orm"

import { getSession } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import {
  ACCOUNT_SETTINGS_PATH,
  myBookingsLoginHref,
} from "@/lib/my-bookings-links"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// The client's own area (docs/plans/client-account.md): any signed-in
// account. Signed out or a demo guest, the one login page, coming back
// here. It speaks the app's language, like the owner and team areas.
export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  const language = await getOwnerLanguage()
  const session = await getSession()
  if (!session || session.isGuest) redirect(myBookingsLoginHref(language))
  const [[owned], unread, rules] = await Promise.all([
    db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerId, session.userId))
      .limit(1),
    getClientUnreadCount(),
    notificationRules(),
  ])
  // One bell state for the page; the first count is rendered here, then the
  // bell keeps it current (docs/plans/client-account.md, D10).
  return (
    <OwnerLanguageProvider language={language}>
      <WordsProvider namespaces={["app", "owner", "public", "notifications", "reviews"]}>
        <NotificationsProvider
          audience="client"
          initialUnread={unread}
          pollSeconds={rules.inAppPollSeconds}
          settingsHref={`${ACCOUNT_SETTINGS_PATH}#notifications`}
        >
          <AccountShell
            ownsBusiness={Boolean(owned)}
            bell={<NotificationBell />}
            account={{
              name: session.name,
              contact: session.contact,
              image: session.image,
            }}
          >
            {children}
          </AccountShell>
        </NotificationsProvider>
        <Toaster />
      </WordsProvider>
    </OwnerLanguageProvider>
  )
}
