import type { Metadata } from "next"
import {
  getCustomerBookings,
  getCustomers,
} from "@/features/dashboard/api/customers"
import { CustomersView } from "@/features/dashboard/components/customers-view"

export const metadata: Metadata = { title: "Customers" }

export default async function CustomersPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/customers">) {
  const { businessId } = await params
  const { customer } = await searchParams
  const openKey = typeof customer === "string" ? customer : null
  const [customers, openBookings] = await Promise.all([
    getCustomers(businessId),
    openKey ? getCustomerBookings(businessId, openKey) : Promise.resolve([]),
  ])
  return (
    <CustomersView
      customers={customers}
      openKey={openKey}
      openBookings={openBookings}
    />
  )
}
