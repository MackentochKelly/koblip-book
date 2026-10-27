import { Suspense } from "react"

import { Toaster } from "@/components/ui/sonner"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { WelcomePanel } from "@/features/dashboard/components/welcome-panel"
import { VerifyEmailAlert } from "@/features/owner-auth/components/verify-email-alert"
import { requireOwner } from "@/lib/dal"

export default async function BusinessDashboardLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]">) {
  const { businessId } = await params
  const owner = await requireOwner(`/dashboard/${businessId}`)
  const { business } = await getOwnerBusiness(businessId)
  return (
    <DashboardShell
      business={{ id: business.id, slug: business.slug, name: business.name }}
      owner={{ name: owner.name, email: owner.email, image: owner.image }}
    >
      {!owner.emailVerified && <VerifyEmailAlert email={owner.email} />}
      {children}
      <Suspense>
        <WelcomePanel slug={business.slug} name={business.name} />
      </Suspense>
      <Toaster />
    </DashboardShell>
  )
}
