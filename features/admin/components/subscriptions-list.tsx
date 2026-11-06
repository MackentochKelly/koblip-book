import { useFormatter, useTranslations } from "next-intl"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLinkIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { initials } from "@/lib/initials"
import { PLANS, type Plan } from "@/lib/plan-features"
import type { AdminSubscription } from "../api/subscriptions"

// Stripe's subscription statuses (docs.stripe.com/billing/subscriptions/overview).
const STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
  "canceled",
] as const
type Status = (typeof STATUSES)[number]

const BADGE: Record<Status, "success" | "destructive" | "warning" | "secondary"> = {
  active: "success",
  trialing: "success",
  past_due: "destructive",
  unpaid: "destructive",
  incomplete: "warning",
  incomplete_expired: "secondary",
  paused: "secondary",
  canceled: "secondary",
}

const isPlan = (plan: string): plan is Plan => (PLANS as readonly string[]).includes(plan)

const known = (status: string): Status =>
  (STATUSES as readonly string[]).includes(status) ? (status as Status) : "incomplete"

// Every subscription, newest first: the business, its owner, the plan and
// period, its status and date, and links to it and its customer in Stripe.
export function SubscriptionsList({
  subscriptions,
}: {
  subscriptions: AdminSubscription[]
}) {
  const t = useTranslations("admin.subscriptions")
  const plans = useTranslations("admin.plans.plans")
  const format = useFormatter()
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" })
  return (
    <ItemGroup className="gap-3">
      {subscriptions.map((sub) => {
        const status = known(sub.status)
        const when = sub.endedAt
          ? t("ended", { date: date(sub.endedAt) })
          : sub.periodEnd
            ? t(sub.cancelling ? "ends" : "renews", { date: date(sub.periodEnd) })
            : null
        return (
          <Item key={sub.id} variant="outline">
            <ItemMedia>
              <Avatar>
                <AvatarFallback>{initials(sub.businessName)}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="max-w-full">
                <span className="truncate">{sub.businessName}</span>
                <Badge variant={BADGE[status]}>{t(`status.${status}`)}</Badge>
              </ItemTitle>
              <ItemDescription className="truncate">
                {[sub.ownerName ?? t("noOwner"), sub.ownerEmail].filter(Boolean).join(" · ")}
              </ItemDescription>
              <ItemDescription className="truncate">
                {[
                  isPlan(sub.plan) ? plans(sub.plan) : sub.plan,
                  t(sub.yearly ? "yearly" : "monthly"),
                  when,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {sub.customerUrl && (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href={sub.customerUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  {t("customer")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("open", { name: sub.businessName })}
                nativeButton={false}
                render={<a href={sub.stripeUrl} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLinkIcon />
              </Button>
            </ItemActions>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
