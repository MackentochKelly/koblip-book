import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { automationsFor } from "@/features/dashboard/api/automation-queries"
import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappFlows } from "@/features/dashboard/components/whatsapp-flows"
import { PlanLocked } from "@/components/plan-locked"
import { hasFeature } from "@/lib/plan-access"
import { automationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.whatsapp")
  return { title: t("parts.flows") }
}

// Flows: what Book answers by itself when a customer writes (D11).
export default async function WhatsappFlowsPage({
  params,
}: PageProps<"/dashboard/[businessId]/automations/flows">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  if (!(await hasFeature(businessId, "whatsappAutomations"))) {
    return <PlanLocked feature="whatsappAutomations" />
  }
  const [automations, connection, rules] = await Promise.all([
    automationsFor(businessId),
    chatConnectionFor(businessId),
    automationRules(),
  ])
  // Flows answer only on the business's own number (D2).
  const ownNumber =
    !!connection &&
    !connection.needsReconnect &&
    connection.messages !== "noNumber" &&
    connection.messages !== "settingUp"
  return (
    <WhatsappFlows
      businessId={businessId}
      businessName={business.name}
      automations={automations}
      ownNumber={ownNumber}
      limits={{
        maxBody: rules.maxBody,
        maxListBody: rules.maxListBody,
        maxButtons: rules.maxButtons,
        maxButtonLabel: rules.maxButtonLabel,
      }}
    />
  )
}
