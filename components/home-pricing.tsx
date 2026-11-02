"use client"

import Image from "next/image"

import { Box, Scene } from "@/components/feature-preview"
import { FindBusinessButton } from "@/components/find-business-button"
import { HOME_SECTION_IDS, HomeBigTitle } from "@/components/home-section-title"
import {
  showcaseCardClassName,
  ShowcasePicture,
} from "@/components/showcase-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckIcon } from "@/components/ui/icons"
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
// colour wash, with what the plan does for you under it. Each plan's button
// sits right under its name: Free's is the same search as the last call to
// action; Pro can't be bought yet, so its button says "Soon" and is off.
export function HomePricing({
  words,
  locale,
}: {
  words: Messages["home"]
  locale: string
}) {
  const t = words.pricing
  return (
    <section
      id={HOME_SECTION_IDS.pricing}
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 sm:px-4"
    >
      <HomeBigTitle start={t.titleStart} end={t.titleEnd} line={t.subtitle} />
      <div className="grid gap-3 md:grid-cols-2">
        <PlanCard
          plan={t.free}
          wash={WASHES.free}
          priceMinor={PRICING_RULES.freePriceMinor}
          perMonth={t.perMonth}
          locale={locale}
          action={
            // A thin ring a shade lighter than the button, not the glass
            // ring, on the white card.
            <FindBusinessButton className="h-11 w-full text-base ring-1 ring-primary/30">
              {words.cta.button}
            </FindBusinessButton>
          }
          sample={
            <>
              <CheckIcon className="size-5 shrink-0 stroke-[2.25] text-success" />
              {words.features.sample.done}
            </>
          }
        />
        <PlanCard
          plan={t.pro}
          wash={WASHES.pro}
          priceMinor={PRICING_RULES.proPriceMinor}
          perMonth={t.perMonth}
          locale={locale}
          badge={words.soon}
          action={
            <Button
              variant="outline"
              disabled
              className="h-11 w-full text-base"
            >
              {words.soon}
            </Button>
          }
          sample={
            <>
              <Image
                src="/brands/stripe.svg"
                alt=""
                width={16}
                height={16}
                unoptimized
                className="mt-0.5 size-4 shrink-0 rounded-sm object-contain"
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
  action,
}: {
  plan: Plan
  wash: (typeof WASHES)[keyof typeof WASHES]
  priceMinor: number
  perMonth: string
  locale: string
  badge?: string
  sample: React.ReactNode
  // The plan's button, right under its name, before the list.
  action: React.ReactNode
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
              {/* The icon stays beside the first line when the words wrap. */}
              <BubbleContent className="flex items-start gap-2 bg-card">
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
      <CardContent>{action}</CardContent>
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
    </Card>
  )
}
