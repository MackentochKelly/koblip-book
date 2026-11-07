"use client"

import { useState, useTransition } from "react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { ViewTabs } from "@/components/view-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SparklesIcon, StarIcon } from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { formatPrice } from "@/lib/format-price"
import { languageOf } from "@/lib/page-language"
import type { Billing } from "../types"
import { AddEmail } from "./add-email"

type Period = "monthly" | "yearly"

// Stripe statuses where the card needs the owner (docs.stripe.com/billing/subscriptions/overview).
const NEEDS_CARD = ["past_due", "unpaid", "incomplete"]

// Settings → Plan (docs/plans/subscriptions.md, P4), laid out like Theme:
// Free and Pro, the current one marked. On Free, the one action is Upgrade
// (Stripe Checkout, monthly or yearly); with a subscription, Manage billing
// (Stripe's portal: card, invoices, switching, cancelling).
export function PlanSection({
  businessId,
  billing,
}: {
  businessId: string
  billing: Billing
}) {
  const t = useTranslations("billing")
  const settings = useTranslations("owner.settings")
  const plans = useTranslations("app.planLocked.plans")
  const format = useFormatter()
  const locale = useLocale()
  // Stripe's pages take the app's language (en, es, pt, fr), not a region.
  const stripeLocale = languageOf(locale)
  const [period, setPeriod] = useState<Period>("monthly")
  const [pending, startTransition] = useTransition()
  const here = `/dashboard/${businessId}/settings/plan`
  const { subscription, prices } = billing
  const onPro = billing.plan === "pro"
  const needsCard = subscription !== null && NEEDS_CARD.includes(subscription.status)

  // Both go to a Stripe page; an error leaves the owner here.
  const go = (open: () => Promise<{ error: unknown }>) =>
    startTransition(async () => {
      const result = await open().catch((error: unknown) => ({ error }))
      if (result.error) toast.error(settings("tryAgain"))
    })
  const upgrade = () =>
    go(() =>
      authClient.subscription.upgrade({
        plan: "pro",
        annual: period === "yearly",
        referenceId: businessId,
        successUrl: here,
        cancelUrl: here,
        locale: stripeLocale,
      })
    )
  const manage = () =>
    go(() =>
      authClient.subscription.billingPortal({
        referenceId: businessId,
        returnUrl: here,
        locale: stripeLocale,
      })
    )

  const price = prices[period]
  const endsAt = subscription?.endsAt
    ? format.dateTime(new Date(subscription.endsAt), { dateStyle: "medium" })
    : null
  // An account made by phone adds a real email before it can upgrade.
  const needsEmail = billing.needsEmail && !subscription
  const proNote = needsEmail
    ? t("needsEmail")
    : needsCard
    ? t("needsCard")
    : endsAt
      ? t(subscription?.cancelling ? "ends" : "renews", { date: endsAt })
      : t(period === "yearly" ? "perYear" : "perMonth", {
          price: formatPrice(price.amountMinor, price.currency, locale),
        })

  return (
    <PageSection
      id="plan"
      title={t("title")}
      action={
        subscription ? (
          <Button onClick={manage} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t("manage")}
          </Button>
        ) : undefined
      }
    >
      {!subscription && !needsEmail && (
        <ViewTabs
          views={[
            { id: "monthly", label: t("monthly") },
            { id: "yearly", label: t("yearly") },
          ]}
          value={period}
          onChange={setPeriod}
          ariaLabel={t("period")}
        />
      )}
      <ItemGroup>
        <Item variant="outline" role="listitem">
          <ItemMedia variant="icon">
            <StarIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{plans("free")}</ItemTitle>
            <ItemDescription>{t("freeNote")}</ItemDescription>
          </ItemContent>
          {!onPro && !needsCard && (
            <ItemActions>
              <Badge variant="success">{t("current")}</Badge>
            </ItemActions>
          )}
        </Item>
        <Item variant="outline" role="listitem">
          <ItemMedia variant="icon">
            <SparklesIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{plans("pro")}</ItemTitle>
            <ItemDescription>{proNote}</ItemDescription>
          </ItemContent>
          <ItemActions>
            {needsCard ? (
              <Badge variant="destructive">{t("paymentFailed")}</Badge>
            ) : onPro ? (
              <Badge variant="success">{t("current")}</Badge>
            ) : needsEmail ? (
              <AddEmail returnTo={here} />
            ) : (
              !subscription && (
                <Button onClick={upgrade} disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  {t("upgrade")}
                </Button>
              )
            )}
          </ItemActions>
        </Item>
      </ItemGroup>
    </PageSection>
  )
}
