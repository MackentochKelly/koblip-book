import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { ownerReviews } from "@/features/reviews/api/queries"
import { OwnerReviews } from "@/features/reviews/components/owner-reviews"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.bookings.customers.parts")
  return { title: t("reviews") }
}

// Every client review of the business, to hide one from its page
// (docs/plans/client-account.md, D15).
export default async function CustomerReviewsPage({
  params,
}: PageProps<"/dashboard/[businessId]/customers/reviews">) {
  const { businessId } = await params
  const reviews = await ownerReviews(businessId)
  if (!reviews) notFound()
  return <OwnerReviews businessId={businessId} reviews={reviews} />
}
