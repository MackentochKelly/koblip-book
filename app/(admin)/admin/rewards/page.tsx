import { getTranslations } from "next-intl/server"

import { GiftIcon } from "@/components/ui/icons"
import { getAdminRewards } from "@/features/admin/api/rewards"
import { AdminPage } from "@/features/admin/components/admin-page"
import { RewardsLists } from "@/features/admin/components/rewards-lists"

// Every business's reward rules, earned rewards and history
// (docs/plans/rewards.md, RW-13). Read only.
export default async function AdminRewardsPage() {
  const [rewards, t] = await Promise.all([
    getAdminRewards(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.rewards")}
      icon={<GiftIcon />}
      empty={rewards.businesses.length ? null : t("rewards.none")}
    >
      <RewardsLists rewards={rewards} />
    </AdminPage>
  )
}
