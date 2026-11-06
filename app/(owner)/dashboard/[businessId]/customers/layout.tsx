import { CustomersFrame } from "@/features/dashboard/components/customers-frame"

// Customers and their reviews, each a part with its own route
// (docs/plans/client-account.md, D15).
export default async function CustomersLayout({
  params,
  children,
}: LayoutProps<"/dashboard/[businessId]/customers">) {
  const { businessId } = await params
  return <CustomersFrame businessId={businessId}>{children}</CustomersFrame>
}
