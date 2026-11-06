import admin from "@/features/admin/i18n/en"
import assistant from "@/features/assistant/i18n/en"
import assistantServer from "@/features/assistant/i18n/server-en"
import ownerBookings from "@/features/dashboard/i18n/en/bookings"
import ownerCatalog from "@/features/dashboard/i18n/en/catalog"
import ownerIntegrations from "@/features/dashboard/i18n/en/integrations"
import ownerSettings from "@/features/dashboard/i18n/en/settings"
import ownerShell from "@/features/dashboard/i18n/en/shell"
import ownerWhatsapp from "@/features/dashboard/i18n/en/whatsapp"
import ownerWidgets from "@/features/dashboard/i18n/en/widgets"
import notifications from "@/features/notifications/i18n/en"
import onboarding from "@/features/onboarding/i18n/en"
import ownerAuth from "@/features/owner-auth/i18n/en"
import starterCatalog from "@/features/starter-catalog/i18n/en"
import teamArea from "@/features/team-area/i18n/en"
import teamCalendar from "@/features/team-calendar/i18n/en"
import app from "@/lib/i18n/en/app"
import appServer from "@/lib/i18n/en/server"
import publicPage from "@/lib/i18n/en/public"

// Every word of the app in English, as ICU messages (next-intl,
// docs/plans/translations.md G4). Each area keeps its own file; this is the
// one list of them. The other languages come from the database
// (lib/translations/interface-words.ts); i18n/sync.ts sends new and changed
// English there.
const messages = {
  admin,
  app,
  appServer,
  assistant,
  assistantServer,
  notifications,
  onboarding,
  owner: {
    bookings: ownerBookings,
    catalog: ownerCatalog,
    integrations: ownerIntegrations,
    settings: ownerSettings,
    shell: ownerShell,
    whatsapp: ownerWhatsapp,
    widgets: ownerWidgets,
  },
  ownerAuth,
  public: publicPage,
  starterCatalog,
  teamArea,
  teamCalendar,
}

export default messages
