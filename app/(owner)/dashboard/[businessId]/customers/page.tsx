import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import {
  getCustomerBookings,
  getCustomers,
} from "@/features/dashboard/api/customers"
import { CustomersView } from "@/features/dashboard/components/customers-view"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.customers") }
}

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
      businessId={businessId}
      customers={customers}
      openKey={openKey}
      openBookings={openBookings}
    />
  )
}
