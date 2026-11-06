import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { SettingsFrame } from "@/features/dashboard/components/settings-frame"
import { lockedPlans } from "@/lib/plan-access"
import { stripeClient } from "@/lib/stripe"

// Settings' frame: tabs, pinned under the top bar on a phone. Each part is a
// route below it (D40). A part the plan lacks shows its plan on its tab.
export default async function SettingsLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/settings">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  return (
    <SettingsFrame
      businessId={businessId}
      lockedPlans={await lockedPlans(businessId)}
      // A demo copy is never billed.
      billing={stripeClient !== null && !business.isDemo}
    >
      {children}
    </SettingsFrame>
  )
}
