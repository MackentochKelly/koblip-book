import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getPolicies } from "@/features/dashboard/api/policy-queries"
import { CardPaymentsSection } from "@/features/dashboard/components/card-payments-section"
import { PaymentsSection } from "@/features/dashboard/components/payments-section"
import { updatePoliciesForPayments } from "@/features/starter-catalog/api/policy-payment-actions"
import { paymentMethodsFor } from "@/lib/payment-methods"
import { policiesBehind, policyPaymentState } from "@/lib/payment-rules"
import { featurePlans, hasFeature } from "@/lib/plan-access"
import {
  cardPayFor,
  stripeConnect,
  stripeStateOf,
  syncStripeAccount,
} from "@/lib/stripe-connect"

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
  // Card payments (docs/plans/online-payments.md): shown where the app has
  // them and the business is real. While Stripe still needs details, it is
  // asked again on each visit: the owner may just be back from its pages.
  const cardsOn = stripeConnect !== null && !business.isDemo
  const [hasCards, plans] = await Promise.all([
    hasFeature(business.id, "onlinePayments"),
    featurePlans(),
  ])
  if (cardsOn && hasCards && business.stripeAccountId && !business.stripeChargesOn) {
    const synced = await syncStripeAccount(business.id, business.stripeAccountId)
    if (synced) business.stripeChargesOn = synced.chargesOn
  }
  const [methods, { policies, points }, card] = await Promise.all([
    paymentMethodsFor(business.id),
    getPolicies(businessId),
    cardPayFor(business),
  ])
  // Policies written for another way of paying than the business offers
  // now: the owner is offered an update. Never for a demo, which has no
  // policies of its own to keep.
  const policiesOutOfDate =
    !business.isDemo &&
    policies.length + points.length > 0 &&
    policiesBehind(
      business.policiesPayment,
      policyPaymentState(methods.length + (card ? 1 : 0), business.payLater)
    )
  return (
    <>
      {cardsOn && (
        <CardPaymentsSection
          businessId={businessId}
          state={
            hasCards
              ? { kind: stripeStateOf(business) }
              : { kind: "plan", plan: plans.onlinePayments }
          }
          setting={{
            mode: business.onlinePay,
            depositType: business.depositType,
            depositValue: business.depositValue,
          }}
          currency={business.currency}
        />
      )}
      <PaymentsSection
        businessId={businessId}
        methods={methods}
        payLater={business.payLater}
        removedTypes={business.removedPaymentTypes}
        asksProof={business.paymentProof}
        teamSeesProof={business.paymentProofTeam}
        policiesOutOfDate={policiesOutOfDate}
        onUpdatePolicies={updatePoliciesForPayments}
        hasCard={card !== null}
      />
    </>
  )
}
