import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { HOME_SECTION_IDS } from "@/components/home-section-title"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CreditCardIcon } from "@/components/ui/icons"
import { featurePlans } from "@/lib/plan-access"
import type { PlanFeatureKey } from "@/lib/plan-features"

// In place of a page whose feature the business's plan doesn't include
// (docs/plans/subscriptions.md, P5): which plan has it, and one action.
// "See plans" opens the home page's plans until Settings → Plan exists (P4).
export async function PlanLocked({ feature }: { feature: PlanFeatureKey }) {
  const [plans, t] = await Promise.all([
    featurePlans(),
    getTranslations("app.planLocked"),
  ])
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CreditCardIcon />
        </EmptyMedia>
        <EmptyTitle>
          {t("title", { plan: t(`plans.${plans[feature]}`) })}
        </EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button
          nativeButton={false}
          render={<Link href={`/#${HOME_SECTION_IDS.pricing}`} />}
        >
          {t("seePlans")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
