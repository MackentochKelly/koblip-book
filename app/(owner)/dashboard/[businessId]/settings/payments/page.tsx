import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getPolicies } from "@/features/dashboard/api/policy-queries"
import { PaymentsSection } from "@/features/dashboard/components/payments-section"
import { updatePoliciesForPayments } from "@/features/starter-catalog/api/policy-payment-actions"
import { paymentMethodsFor } from "@/lib/payment-methods"
import { policiesBehind, policyPaymentState } from "@/lib/payment-rules"

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
  const [methods, { policies, points }] = await Promise.all([
    paymentMethodsFor(business.id),
    getPolicies(businessId),
  ])
  // Policies written for another way of paying than the business offers
  // now: the owner is offered an update. Never for a demo, which has no
  // policies of its own to keep.
  const policiesOutOfDate =
    !business.isDemo &&
    policies.length + points.length > 0 &&
    policiesBehind(
      business.policiesPayment,
      policyPaymentState(methods.length, business.payLater)
    )
  return (
    <PaymentsSection
      businessId={businessId}
      methods={methods}
      payLater={business.payLater}
      removedTypes={business.removedPaymentTypes}
      policiesOutOfDate={policiesOutOfDate}
      onUpdatePolicies={updatePoliciesForPayments}
    />
  )
}
