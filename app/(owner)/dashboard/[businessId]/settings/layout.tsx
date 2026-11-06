import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { SettingsFrame } from "@/features/dashboard/components/settings-frame"
import { lockedPlans } from "@/lib/plan-access"

// Settings' frame: tabs, pinned under the top bar on a phone. Each part is a
// route below it (D40). A part the plan lacks shows its plan on its tab.
export default async function SettingsLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/settings">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  return (
    <SettingsFrame businessId={businessId} lockedPlans={await lockedPlans(businessId)}>
      {children}
    </SettingsFrame>
  )
}
