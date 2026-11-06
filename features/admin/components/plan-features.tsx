"use client"

import { useOptimistic, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { SquarePenIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { FeaturePlans } from "@/lib/plan-access"
import {
  isPlan,
  PLAN_FEATURE_GROUPS,
  PLAN_FEATURES,
  PLANS,
  planMovable,
  type Plan,
  type PlanFeatureKey,
} from "@/lib/plan-features"
import { TOUCH_AREA } from "@/lib/touch-area"
import { saveFeaturePlan } from "../api/plan-actions"
import type { PlanFeatureChange } from "../api/plans"

const KEYS = Object.keys(PLAN_FEATURES) as PlanFeatureKey[]

// Admin → Plans (docs/plans/subscriptions.md, P0): every feature in its
// group with the lowest plan that has it, picked right on the row; a
// changed one shows its default. A built feature with no plan check yet
// can't move (lib/plan-features.ts, planMovable). Below, every change,
// newest first.
export function PlanFeatures({
  plans,
  changes,
}: {
  plans: FeaturePlans
  changes: PlanFeatureChange[]
}) {
  const t = useTranslations("admin.plans")
  const locale = useLocale()
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

  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const planName = (plan: Plan | null, key: PlanFeatureKey) =>
    plan
      ? t(`plans.${plan}`)
      : `${t("defaultPlan")} (${t(`plans.${PLAN_FEATURES[key].defaultPlan}`)})`

  return (
    <div className="flex flex-col gap-8">
      {PLAN_FEATURE_GROUPS.map((group) => (
        <section
          key={group}
          className="flex flex-col gap-3"
          aria-labelledby={`plans-${group}`}
        >
          <h2
            id={`plans-${group}`}
            className="text-lg font-semibold tracking-tight"
          >
            {t(`groups.${group}`)}
          </h2>
          <ItemGroup className="gap-3">
            {KEYS.filter((key) => PLAN_FEATURES[key].group === group).map(
              (key) => {
                const feature = PLAN_FEATURES[key]
                const plan = shown[key]
                const changed = plan !== feature.defaultPlan
                const movable = planMovable(key)
                return (
                  <Item key={key} variant="outline">
                    <ItemContent className="min-w-0">
                      <ItemTitle id={`plan-feature-${key}`}>
                        {t(`features.${key}`)}
                        {feature.status === "soon" && (
                          <Badge variant="secondary">{t("soon")}</Badge>
                        )}
                      </ItemTitle>
                      {changed && (
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
                      <ToggleGroup
                        variant="outline"
                        aria-labelledby={`plan-feature-${key}`}
                        value={[plan]}
                        disabled={!movable}
                        onValueChange={(next) => {
                          const picked = next[0]
                          if (isPlan(picked) && picked !== plan) pick(key, picked)
                        }}
                      >
                        {PLANS.map((item) => (
                          <ToggleGroupItem
                            key={item}
                            value={item}
                            className={TOUCH_AREA}
                          >
                            {t(`plans.${item}`)}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </ItemActions>
                  </Item>
                )
              }
            )}
          </ItemGroup>
        </section>
      ))}
      <section className="flex flex-col gap-3" aria-labelledby="plans-changes">
        <h2
          id="plans-changes"
          className="text-lg font-semibold tracking-tight"
        >
          {t("changes.title")}
        </h2>
        {changes.length ? (
          <ItemGroup className="gap-3">
            {changes.map((change) => (
              <Item key={change.id} variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle>{t(`features.${change.featureKey}`)}</ItemTitle>
                  <ItemDescription className="break-words">
                    {`${planName(change.before, change.featureKey)} → ${planName(change.after, change.featureKey)}`}
                  </ItemDescription>
                  <ItemDescription className="truncate">
                    {[
                      change.changedBy ?? t("changes.someone"),
                      when.format(new Date(change.changedAt)),
                    ].join(" · ")}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SquarePenIcon />
              </EmptyMedia>
              <EmptyTitle>{t("changes.none")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  )
}
