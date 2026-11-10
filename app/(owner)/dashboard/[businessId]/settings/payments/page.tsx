import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { PaymentsSection } from "@/features/dashboard/components/payments-section"
import { paymentMethodsFor } from "@/lib/payment-methods"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.settings")
  return { title: t("parts.payments") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function PaymentsPage({ params }: Props) {
  const { businessId } = await params
  // Checks the business is the signed-in owner's before anything is read.
  const { business } = await getOwnerBusiness(businessId)
  const methods = await paymentMethodsFor(business.id)
  return (
    <PaymentsSection
      businessId={businessId}
      methods={methods}
      payLater={business.payLater}
      removedTypes={business.removedPaymentTypes}
    />
  )
}
