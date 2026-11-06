import { getTranslations } from "next-intl/server"

import { StarIcon } from "@/components/ui/icons"
import { AdminPage } from "@/features/admin/components/admin-page"
import { adminReviews } from "@/features/reviews/api/queries"
import { AdminReviews } from "@/features/reviews/components/admin-reviews"

// Reviews (client account D15): every client review and the rules they
// follow.
export default async function AdminReviewsPage() {
  const [reviews, t] = await Promise.all([
    adminReviews(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage title={t("nav.reviews")} icon={<StarIcon />} empty={null}>
      <AdminReviews reviews={reviews} />
    </AdminPage>
  )
}
