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
import { CreditCardIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { formatPrice } from "@/lib/format-price"
import type { AdminOnlinePayments } from "../api/online-payments"

type View = "businesses" | "history"

function None({ title }: { title: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CreditCardIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}

// Admin > Online payments (docs/plans/online-payments.md, ON-11): each
// business's Stripe account and what its customers pay by card, and
// everything that happened to a payment. Read only.
export function OnlinePaymentsLists({
  payments,
}: {
  payments: AdminOnlinePayments
}) {
  const t = useTranslations("admin.onlinePayments")
  const locale = useLocale()
  const [view, setView] = useState<View>("businesses")
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const payOf = (business: AdminOnlinePayments["businesses"][number]) => {
    const { pay } = business
    if (!pay) return t("pay.off")
    if (pay.mode === "full") return t("pay.full")
    return pay.type === "percent"
      ? t("pay.percent", { percent: pay.value })
      : t("pay.amount", {
          amount: formatPrice(pay.value, business.currency, locale),
        })
  }
  return (
    <div className="flex flex-col gap-6">
      <ViewTabs
        variant="line"
        ariaLabel={t("partsLabel")}
        views={[
          { id: "businesses", label: t("parts.businesses") },
          { id: "history", label: t("parts.history") },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "businesses" &&
        (payments.businesses.length === 0 ? (
          <None title={t("none")} />
        ) : (
          <ItemGroup className="gap-3">
            {payments.businesses.map((business) => (
              <Item key={business.id} variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{business.name}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {[payOf(business), business.stripeAccountId]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge
                    variant={
                      business.state === "ready" ? "secondary" : "outline"
                    }
                  >
                    {t(`state.${business.state}`)}
                  </Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ))}
      {view === "history" &&
        (payments.events.length === 0 ? (
          <None title={t("noHistory")} />
        ) : (
          <ItemGroup className="gap-3">
            {payments.events.map((event) => (
              <Item key={event.id} variant="outline">
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    {event.kind ? t(`kinds.${event.kind}`) : t("kinds.other")}
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {[
                      event.businessName ?? event.stripeAccountId,
                      event.customerName,
                      event.note,
                      when.format(new Date(event.at)),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                {event.amountMinor !== null && event.currency && (
                  <ItemActions>
                    <Badge variant="outline">
                      {formatPrice(event.amountMinor, event.currency, locale)}
                    </Badge>
                  </ItemActions>
                )}
              </Item>
            ))}
          </ItemGroup>
        ))}
    </div>
  )
}
