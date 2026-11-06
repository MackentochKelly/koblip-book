"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { FilterChips } from "@/components/filter-chips"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import type { FeaturePlans } from "@/lib/plan-access"
import {
  PLAN_FEATURE_GROUPS,
  PLAN_FEATURES,
  PLANS,
  planMovable,
  type Plan,
  type PlanFeatureGroup,
  type PlanFeatureKey,
} from "@/lib/plan-features"
import { saveFeaturePlan } from "../api/plan-actions"

const KEYS = Object.keys(PLAN_FEATURES) as PlanFeatureKey[]

// Admin → Plans (docs/plans/subscriptions.md, P0): the group chips, as on
// Services, then every feature in its group with the lowest plan that has
// it, picked with the app's switcher (ViewTabs, as Bookings' list and
// calendar); a changed one shows its default. A built feature with no plan
// check yet can't move (lib/plan-features.ts, planMovable).
export function PlanFeatures({ plans }: { plans: FeaturePlans }) {
  const t = useTranslations("admin.plans")
  const [group, setGroup] = useState<PlanFeatureGroup | null>(null)
  const [shown, showPlan] = useOptimistic(
    plans,
    (current, change: { key: PlanFeatureKey; plan: Plan }) => ({
      ...current,
      [change.key]: change.plan,
    })
  )
  const [, startTransition] = useTransition()

  function pick(key: PlanFeatureKey, plan: Plan) {
    startTransition(async () => {
      showPlan({ key, plan })
      const done = await saveFeaturePlan(key, plan).catch(() => null)
      if (done?.ok) toast.success(t("saved"))
      else toast.error(t("failed"))
    })
  }

  const planTabs = PLANS.map((id) => ({ id, label: t(`plans.${id}`) }))

  return (
    <div className="flex flex-col gap-6">
      <FilterChips
        label={t("groupsLabel")}
        all={t("all")}
        options={PLAN_FEATURE_GROUPS.map((id) => ({
          value: id,
          label: t(`groups.${id}`),
        }))}
        value={group}
        onValueChange={setGroup}
      />
      {PLAN_FEATURE_GROUPS.filter((id) => group === null || id === group).map(
        (id) => (
          <section
            key={id}
            className="flex flex-col gap-3"
            aria-labelledby={`plans-${id}`}
          >
            <h2
              id={`plans-${id}`}
              className="text-lg font-semibold tracking-tight"
            >
              {t(`groups.${id}`)}
            </h2>
            <ItemGroup className="gap-3">
              {KEYS.filter((key) => PLAN_FEATURES[key].group === id).map(
                (key) => {
                  const feature = PLAN_FEATURES[key]
                  const plan = shown[key]
                  const movable = planMovable(key)
                  return (
                    <Item key={key} variant="outline">
                      <ItemContent className="min-w-0">
                        <ItemTitle>
                          {t(`features.${key}`)}
                          {feature.status === "soon" && (
                            <Badge variant="secondary">{t("soon")}</Badge>
                          )}
                        </ItemTitle>
                        {plan !== feature.defaultPlan && (
                          <ItemDescription>
                            {t("byDefault", {
                              plan: t(`plans.${feature.defaultPlan}`),
                            })}
                          </ItemDescription>
                        )}
                        {!movable && (
                          <ItemDescription>{t("noCheck")}</ItemDescription>
                        )}
                      </ItemContent>
                      <ItemActions>
                        <ViewTabs
                          views={planTabs}
                          value={plan}
                          onChange={(next) => {
                            if (next !== plan) pick(key, next)
                          }}
                          ariaLabel={t(`features.${key}`)}
                          disabled={!movable}
                        />
                      </ItemActions>
                    </Item>
                  )
                }
              )}
            </ItemGroup>
          </section>
        )
      )}
    </div>
  )
}
