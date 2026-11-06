import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { getBilling } from "@/features/billing/api/queries"
import { PlanSection } from "@/features/billing/components/plan-section"
import { stripeClient } from "@/lib/stripe"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.settings")
  return { title: t("parts.plan") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

// Settings → Plan (docs/plans/subscriptions.md, P4): only once billing is
// set up (lib/stripe.ts), and only for a real business's owner (getBilling).
export default async function PlanPage({ params }: Props) {
  const { businessId } = await params
  if (!stripeClient) notFound()
  const billing = await getBilling(businessId)
  return <PlanSection businessId={businessId} billing={billing} />
}
