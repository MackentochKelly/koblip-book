"use client"

import {
  HOME_SECTION_IDS,
  homeSectionTitleClassName,
} from "@/components/home-section-title"
import { Money } from "@/components/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckIcon, SearchIcon } from "@/components/ui/icons"
import { Separator } from "@/components/ui/separator"
import { useFindBusiness } from "@/hooks/use-find-business"
import type { Messages } from "@/lib/i18n"
import { PRICING_RULES } from "@/lib/pricing-rules"
import { cn } from "@/lib/utils"

// The home page's two plans, side by side (adapted from shadcn Space's
// pricing-01 block). Free is the one action: the same search as the last
// call to action. Pro can't be bought yet, so it has "Soon" and no button.
export function HomePricing({
  words,
  locale,
}: {
  words: Messages["home"]
  locale: string
}) {
  const findBusiness = useFindBusiness()
  const t = words.pricing
  return (
    <section
      id={HOME_SECTION_IDS.pricing}
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 pt-12 pb-12 sm:px-4 sm:pt-24"
    >
      <h2 className={cn(homeSectionTitleClassName, "px-2")}>{t.title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <PlanCard
          plan={t.free}
          priceMinor={PRICING_RULES.freePriceMinor}
          perMonth={t.perMonth}
          locale={locale}
        >
          <CardFooter className="mt-auto">
            <Button size="lg" className="w-full" onClick={findBusiness}>
              <SearchIcon data-icon="inline-start" />
              {words.cta.button}
            </Button>
          </CardFooter>
        </PlanCard>
        <PlanCard
          plan={t.pro}
          priceMinor={PRICING_RULES.proPriceMinor}
          perMonth={t.perMonth}
          locale={locale}
          badge={words.soon}
        />
      </div>
    </section>
  )
}

function PlanCard({
  plan,
  priceMinor,
  perMonth,
  locale,
  badge,
  children,
}: {
  plan: Messages["home"]["pricing"]["free"]
  priceMinor: number
  perMonth: string
  locale: string
  badge?: string
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl tracking-tight">
          {plan.name}
        </CardTitle>
        <CardDescription className="text-base">{plan.note}</CardDescription>
        {badge && (
          <CardAction>
            <Badge variant="secondary">{badge}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="flex items-baseline gap-1 font-display text-5xl font-medium tracking-tight">
          <Money
            priceMinor={priceMinor}
            currency={PRICING_RULES.currency}
            locale={locale}
          />
          <span className="text-base font-normal tracking-normal text-muted-foreground">
            {perMonth}
          </span>
        </p>
        <Separator />
        <ul className="flex flex-col gap-3 text-base">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckIcon
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-muted-foreground"
              />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      {children}
    </Card>
  )
}
