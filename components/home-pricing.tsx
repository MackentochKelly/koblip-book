"use client"

import Image from "next/image"

import { Box, Scene } from "@/components/feature-preview"
import { HOME_SECTION_IDS } from "@/components/home-section-title"
import {
  showcaseCardClassName,
  ShowcasePicture,
} from "@/components/showcase-row"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
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
import { useFindBusiness } from "@/hooks/use-find-business"
import { moneyShortParts } from "@/lib/format-price"
import type { Messages } from "@/lib/i18n"
import { PRICING_RULES } from "@/lib/pricing-rules"

type Plan = Messages["home"]["pricing"]["free"]

// Each plan's picture: a still colour wash, as on the "What you get" cards.
const WASHES = {
  free: { colors: ["--background", "--hero-accent", "--chart-1"], seed: 40 },
  pro: { colors: ["--background", "--verified", "--chart-2"], seed: 80 },
} as const

// The home page's two plans (adapted from shadcn Space's pricing-01 block,
// in the "What you get" cards' style): the price in the glass box on a
// colour wash, with what the plan does for you under it. Free is the one
// action: the same search as the last call to action. Pro can't be bought
// yet, so it has "Soon" and no button.
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
      <div className="mb-4 flex flex-col items-center gap-2 px-2 text-center">
        <h2 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          {t.titleStart}{" "}
          <span className="font-serif font-normal tracking-normal italic">
            {t.titleEnd}
          </span>
        </h2>
        <p className="text-balance text-muted-foreground">{t.subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PlanCard
          plan={t.free}
          wash={WASHES.free}
          priceMinor={PRICING_RULES.freePriceMinor}
          perMonth={t.perMonth}
          locale={locale}
          sample={
            <>
              <CheckIcon className="size-4 shrink-0 text-success" />
              {words.features.sample.done}
            </>
          }
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
          wash={WASHES.pro}
          priceMinor={PRICING_RULES.proPriceMinor}
          perMonth={t.perMonth}
          locale={locale}
          badge={words.soon}
          sample={
            <>
              <Image
                src="/brands/whatsapp-glyph-green.svg"
                alt=""
                width={16}
                height={16}
                unoptimized
                className="size-4 shrink-0 object-contain"
              />
              {t.proSample}
            </>
          }
        />
      </div>
    </section>
  )
}

function PlanCard({
  plan,
  wash,
  priceMinor,
  perMonth,
  locale,
  badge,
  sample,
  children,
}: {
  plan: Plan
  wash: (typeof WASHES)[keyof typeof WASHES]
  priceMinor: number
  perMonth: string
  locale: string
  badge?: string
  sample: React.ReactNode
  children?: React.ReactNode
}) {
  // "$19", in the visitor's language's own order.
  const price = moneyShortParts(priceMinor, PRICING_RULES.currency, locale)
    .map((part) => part.text)
    .join("")
  return (
    <Card className={showcaseCardClassName}>
      {/* Taller on phones: the box and the message both fit on the wash. */}
      <ShowcasePicture className="max-sm:aspect-4/3">
        <Scene {...wash}>
          <div className="flex flex-col items-center gap-2">
            <Box className="w-fit">
              <p className="flex items-baseline gap-1 px-(--card-spacing) font-display text-5xl font-medium tracking-tight">
                {price}
                <span className="text-base font-normal tracking-normal text-muted-foreground">
                  {perMonth}
                </span>
              </p>
            </Box>
            <Bubble variant="outline">
              <BubbleContent className="flex items-center gap-2 bg-card">
                {sample}
              </BubbleContent>
            </Bubble>
          </div>
        </Scene>
      </ShowcasePicture>
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
      <CardContent>
        <ul className="flex flex-col gap-3 text-base">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground">
                <CheckIcon aria-hidden="true" className="size-4" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      {children}
    </Card>
  )
}
