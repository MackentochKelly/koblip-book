"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { AppSelect } from "@/components/app-select"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { GiftIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { useRewardWords } from "@/hooks/use-reward-words"
import { formatDay } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import type { RewardRule } from "@/lib/reward-rules"
import type { OwnerRewardActivity } from "../types"

const ALL = "all"

// Rewards > Activity (docs/plans/rewards.md, RW-9): three counts, then the
// history, newest first, for one reward or all. Each line opens its
// customer.
export function RewardsActivity({
  businessId,
  currency,
  rules,
  ruleId,
  activity,
}: {
  businessId: string
  currency: string
  // Every rule, removed ones too: their history stays.
  rules: RewardRule[]
  ruleId: string | null
  activity: OwnerRewardActivity
}) {
  const t = useTranslations("owner.rewards")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const words = useRewardWords(currency)
  const stats = [
    { label: t("activity.earning"), value: activity.counts.earning },
    { label: t("activity.waiting"), value: activity.counts.waiting },
    { label: t("activity.used"), value: activity.counts.used },
  ]
  const ruleOf = (id: string) => rules.find((rule) => rule.id === id)
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle>{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {rules.length > 1 && (
        <AppSelect
          aria-label={t("activity.filter")}
          options={[
            { value: ALL, label: t("activity.all") },
            ...rules.map((rule) => ({
              value: rule.id,
              label: `${words.prize(rule)} · ${words.earn(rule)}`,
            })),
          ]}
          value={ruleId ?? ALL}
          onValueChange={(value) =>
            router.replace(
              value === ALL
                ? pathname
                : `${pathname}?rule=${encodeURIComponent(value)}`,
              { scroll: false }
            )
          }
          className="w-full"
        />
      )}
      {activity.events.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GiftIcon />
            </EmptyMedia>
            <EmptyTitle>{t("activity.none")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {activity.events.map((event) => {
            // A reward given by hand moves no count; a convert that adds
            // back is a reward taken back.
            const type =
              event.type === "adjust" && event.amount === 0
                ? "given"
                : event.type === "convert" && event.amount > 0
                  ? "unconvert"
                  : event.type
            const counted = event.type !== "convert" && event.amount !== 0
            const spend = ruleOf(event.ruleId)?.earnType === "spend"
            return (
              <Item
                key={event.id}
                variant="outline"
                render={
                  <Link
                    href={`/dashboard/${businessId}/customers?customer=${encodeURIComponent(event.customerKey)}`}
                  />
                }
              >
                <ItemContent className="min-w-0">
                  <ItemTitle>{event.customerName}</ItemTitle>
                  <ItemDescription>
                    {[
                      t(`customer.types.${type}`),
                      formatDay(event.date, locale),
                      event.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                {counted && (
                  <ItemActions className="text-muted-foreground tabular-nums">
                    {event.amount > 0 && "+"}
                    {spend
                      ? formatPrice(event.amount, currency, locale)
                      : event.amount}
                  </ItemActions>
                )}
              </Item>
            )
          })}
        </ItemGroup>
      )}
    </div>
  )
}
