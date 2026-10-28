import { Suspense } from "react"

import { Toaster } from "@/components/ui/sonner"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
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
  const verify = (await getOwnerMessages()).settings.verify
  return (
    <DashboardShell
      business={{ id: business.id, slug: business.slug, name: business.name }}
      owner={{ name: owner.name, email: owner.email, image: owner.image }}
    >
      {!owner.emailVerified && (
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
  )
}
