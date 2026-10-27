import { Toaster } from "@/components/ui/sonner"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
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
      owner={{ name: owner.name, email: owner.email }}
    >
      {children}
      <Toaster />
    </DashboardShell>
  )
}
