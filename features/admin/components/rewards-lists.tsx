"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
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
import { formatPrice } from "@/lib/format-price"
import type { AdminRewards } from "../api/rewards"

type View = "rules" | "earned" | "history"

function None({ title }: { title: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GiftIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

// One business's rules, in its own currency's words.
function BusinessRules({
  business,
}: {
  business: AdminRewards["businesses"][number]
}) {
  const t = useTranslations("admin.rewards")
  const words = useRewardWords(business.currency)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="min-w-0 truncate text-sm font-medium text-muted-foreground">
        {business.name}
      </h2>
      <ItemGroup className="gap-3">
        {business.rules.map((rule) => (
          <Item key={rule.id} variant="outline">
            <ItemContent className="min-w-0">
              <ItemTitle>{words.prize(rule)}</ItemTitle>
              <ItemDescription>{words.earn(rule)}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge
                variant={rule.status === "active" ? "secondary" : "outline"}
              >
                {t(`rule.${rule.status}`)}
              </Badge>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  )
}

function EarnedRow({ row }: { row: AdminRewards["earned"][number] }) {
  const t = useTranslations("admin.rewards")
  const locale = useLocale()
  const words = useRewardWords(row.currency)
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
  return (
    <Item variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle>{words.reward(row.reward)}</ItemTitle>
        <ItemDescription className="truncate">
          {[
            row.businessName,
            row.customer,
            day.format(new Date(row.earnedAt)),
            row.expiresAt && t("expires", { date: new Date(row.expiresAt) }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant={row.status === "available" ? "secondary" : "outline"}>
          {t(`status.${row.status}`)}
        </Badge>
      </ItemActions>
    </Item>
  )
}

// Admin > Rewards (docs/plans/rewards.md, RW-13): each business's rules,
// the rewards customers earned, and the whole history. Read only.
export function RewardsLists({ rewards }: { rewards: AdminRewards }) {
  const t = useTranslations("admin.rewards")
  const locale = useLocale()
  const [view, setView] = useState<View>("rules")
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  return (
    <div className="flex flex-col gap-6">
      <ViewTabs
        variant="line"
        ariaLabel={t("partsLabel")}
        views={[
          { id: "rules", label: t("parts.rules") },
          { id: "earned", label: t("parts.earned") },
          { id: "history", label: t("parts.history") },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "rules" && (
        <div className="flex flex-col gap-8">
          {rewards.businesses.map((business) => (
            <BusinessRules key={business.id} business={business} />
          ))}
        </div>
      )}
      {view === "earned" &&
        (rewards.earned.length === 0 ? (
          <None title={t("noEarned")} />
        ) : (
          <ItemGroup className="gap-3">
            {rewards.earned.map((row) => (
              <EarnedRow key={row.id} row={row} />
            ))}
          </ItemGroup>
        ))}
      {view === "history" &&
        (rewards.history.length === 0 ? (
          <None title={t("noHistory")} />
        ) : (
          <ItemGroup className="gap-3">
            {rewards.history.map((event) => {
              // A reward given by hand moves no count; a convert that adds
              // back is a reward taken back.
              const type =
                event.type === "adjust" && event.amount === 0
                  ? "given"
                  : event.type === "convert" && event.amount > 0
                    ? "unconvert"
                    : event.type
              return (
                <Item key={event.id} variant="outline">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{`${event.customer} · ${t(`types.${type}`)}`}</ItemTitle>
                    <ItemDescription className="truncate">
                      {[
                        event.businessName,
                        when.format(new Date(event.at)),
                        t(`actors.${event.actor}`),
                        event.note,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  {event.amount !== 0 && (
                    <ItemActions className="text-muted-foreground tabular-nums">
                      {event.amount > 0 && "+"}
                      {event.spend
                        ? formatPrice(event.amount, event.currency, locale)
                        : event.amount}
                    </ItemActions>
                  )}
                </Item>
              )
            })}
          </ItemGroup>
        ))}
    </div>
  )
}
