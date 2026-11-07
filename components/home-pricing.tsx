"use client"

import { useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CheckIcon, SparklesIcon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { useFindBusiness } from "@/hooks/use-find-business"
import { moneyShortParts } from "@/lib/format-price"
import { PRICING_RULES } from "@/lib/pricing-rules"

// Each plan's picture: a still colour wash, as on the "What you get" cards.
const WASHES = {
  free: { colors: ["--background", "--hero-accent", "--chart-1"], seed: 40 },
  pro: { colors: ["--background", "--verified", "--chart-2"], seed: 80 },
} as const

// What each plan does for you, in order (its words' keys). "soon": not
// built yet (lib/plan-features.ts), so it says so.
const FEATURES = {
  free: [
    { key: "free.features.page" },
    { key: "free.features.bookings" },
    { key: "free.features.catalog" },
    { key: "free.features.assistant" },
    { key: "free.features.reminders" },
    { key: "free.features.messages" },
    { key: "free.features.calendar" },
    { key: "free.features.languages" },
  ],
  pro: [
    { key: "pro.features.everything" },
    { key: "pro.features.messages" },
    { key: "pro.features.payments", soon: true },
    { key: "pro.features.sms", soon: true },
    { key: "pro.features.buttons", soon: true },
    { key: "pro.features.reviews", soon: true },
  ],
} as const satisfies Record<string, readonly { key: string; soon?: boolean }[]>

type Plan = keyof typeof FEATURES

// The WhatsApp messages a month each plan sends on Koblip's number: the
// admin's limits (lib/notification-rules.ts).
export type PlanMessages = Record<Plan, number>

// The home page's two plans (adapted from shadcn Space's pricing-01 block,
// in the "What you get" cards' style): the price in the glass box on a
// colour wash, with what the plan does for you under it. Each plan's button
// sits right under its name: Free's is the same search as the last call to
// action. Get Pro (P8) keeps the choice (choosePro), then opens the owner's
// Settings → Plan when signed in, else the same search: every business
// starts on Free, and its ready page then leads to Plan's Checkout.
export function HomePricing({
  signedIn,
  choosePro,
  messages,
}: {
  signedIn: boolean
  choosePro: () => Promise<void>
  messages: PlanMessages
}) {
  const home = useTranslations("public.home")
  const t = useTranslations("public.home.pricing")
  const locale = useLocale()
  const router = useRouter()
  const findBusiness = useFindBusiness()
  const [pending, startTransition] = useTransition()
  const getPro = () =>
    startTransition(async () => {
      await choosePro().catch(() => undefined)
      if (signedIn) router.push(PRO_PLAN_PATH)
      else findBusiness()
    })
  const yearly = moneyShortParts(
    PRICING_RULES.proYearlyPriceMinor,
    PRICING_RULES.currency,
    locale
  )
    .map((part) => part.text)
    .join("")
  return (
    <section
      id={HOME_SECTION_IDS.pricing}
      className="mx-auto flex w-full max-w-page flex-col gap-4 px-2 sm:px-4"
    >
      <HomeBigTitle
        start={t("titleStart")}
        end={t("titleEnd")}
        line={t("subtitle")}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <PlanCard
          plan="free"
          priceMinor={PRICING_RULES.freePriceMinor}
          messages={messages.free}
          action={
            // A thin ring a shade lighter than the button, not the glass
            // ring, on the white card.
            <FindBusinessButton className="h-11 w-full text-base ring-1 ring-primary/30">
              {home("cta.button")}
            </FindBusinessButton>
          }
          sample={
            <>
              <CheckIcon className="size-5 shrink-0 stroke-[2.25] text-success" />
              {home("features.sample.done")}
            </>
          }
        />
        <PlanCard
          plan="pro"
          priceMinor={PRICING_RULES.proPriceMinor}
          priceNote={t("perYear", { price: yearly })}
          messages={messages.pro}
          soon={home("soon")}
          action={
            <Button
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={getPro}
              className="h-11 w-full text-base"
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              {t("getPro")}
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
              {t("proSample")}
            </>
          }
        />
      </div>
    </section>
  )
}

// The dashboard opens the owner's last business on its Plan screen.
const PRO_PLAN_PATH = "/dashboard?plan=pro"

function PlanCard({
  plan,
  priceMinor,
  priceNote,
  messages,
  soon,
  sample,
  action,
}: {
  plan: Plan
  priceMinor: number
  // Under the price, inside the box.
  priceNote?: string
  messages: number
  // The "Soon" badge's word, on the lines not built yet.
  soon?: string
  sample: React.ReactNode
  // The plan's button, right under its name, before the list.
  action: React.ReactNode
}) {
  const t = useTranslations("public.home.pricing")
  const locale = useLocale()
  // "$19", in the visitor's language's own order.
  const price = moneyShortParts(priceMinor, PRICING_RULES.currency, locale)
    .map((part) => part.text)
    .join("")
  return (
    <Card className={showcaseCardClassName}>
      {/* Taller on phones: the box and the message both fit on the wash. */}
      <ShowcasePicture className="max-sm:aspect-4/3">
        <Scene {...WASHES[plan]}>
          <div className="flex flex-col items-center gap-2">
            <Box className="w-fit">
              <div className="flex flex-col items-center px-(--card-spacing)">
                <p className="flex items-baseline gap-1 font-display text-5xl font-medium tracking-tight">
                  {price}
                  <span className="text-base font-normal tracking-normal text-muted-foreground">
                    {t("perMonth")}
                  </span>
                </p>
                {priceNote && (
                  <p className="text-sm text-muted-foreground">{priceNote}</p>
                )}
              </div>
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
          {t(`${plan}.name`)}
        </CardTitle>
        <CardDescription className="text-base">
          {t(`${plan}.note`)}
        </CardDescription>
      </CardHeader>
      <CardContent>{action}</CardContent>
      <CardContent>
        <ul className="flex flex-col gap-3 text-base">
          {FEATURES[plan].map((feature) => (
            <li key={feature.key} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/25 dark:text-primary-foreground">
                <CheckIcon aria-hidden="true" className="size-4" />
              </span>
              {t(feature.key, { count: messages })}
              {"soon" in feature && soon && (
                <Badge variant="secondary">{soon}</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
