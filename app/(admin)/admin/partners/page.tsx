import { getTranslations } from "next-intl/server"

import { PageSection } from "@/components/page-section"
import { LinkIcon } from "@/components/ui/icons"
import { getPartners } from "@/features/admin/api/partners"
import { AdminPage } from "@/features/admin/components/admin-page"
import {
  PartnerEvents,
  PartnerInvites,
} from "@/features/admin/components/partner-activity"
import {
  AddPartnerApp,
  PartnerApps,
} from "@/features/admin/components/partner-apps"

// Partners (docs/plans/sales-connection.md, SC10): the apps that bring
// businesses through the partner API, their invites, and the events sent
// back to them. The one action adds an app.
export default async function AdminPartnersPage() {
  const [{ apps, invites, events }, t] = await Promise.all([
    getPartners(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.partners")}
      icon={<LinkIcon />}
      empty={apps.length ? null : t("partners.none")}
      action={<AddPartnerApp />}
    >
      <div className="flex flex-col gap-8">
        <PartnerApps apps={apps} />
        <PageSection id="invites" title={t("partners.invites.title")}>
          <PartnerInvites invites={invites} />
        </PageSection>
        <PageSection id="events" title={t("partners.events.title")}>
          <PartnerEvents events={events} />
        </PageSection>
      </div>
    </AdminPage>
  )
}
