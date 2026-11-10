import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { PageSection } from "@/components/page-section"
import { Button } from "@/components/ui/button"
import { GiftIcon } from "@/components/ui/icons"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { useRewardWords } from "@/hooks/use-reward-words"
import { formatPrice } from "@/lib/format-price"
import { bookAgainHref } from "@/lib/my-bookings-links"
import { languageOf } from "@/lib/page-language"
import type { MyRewardsPlace } from "../types"
import { AccountEmpty } from "./account-empty"

// One business: what is ready to redeem, then how far each rule is.
function PlaceRewards({ place }: { place: MyRewardsPlace }) {
  const t = useTranslations("public.account")
  const locale = useLocale()
  const words = useRewardWords(place.currency)
  return (
    <PageSection
      id={`rewards-${place.business.slug}`}
      title={place.business.name}
      action={
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link
              href={bookAgainHref(
                place.business.slug,
                null,
                languageOf(locale)
              )}
            />
          }
        >
          {t("bookAgain")}
        </Button>
      }
    >
      <ItemGroup className="gap-3">
        {place.rewards.map((reward) => (
          <Item key={reward.id} variant="box">
            <ItemMedia variant="icon">
              <GiftIcon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full break-words">
                {words.reward(reward.reward)}
              </ItemTitle>
              {reward.expires && (
                <ItemDescription>
                  {t("rewards.expires", { when: reward.expires })}
                </ItemDescription>
              )}
            </ItemContent>
          </Item>
        ))}
        {place.progress.map(({ rule, done }) => (
          <Item key={rule.id} variant="box">
            <ItemContent className="min-w-0">
              <Progress value={(done / rule.goal) * 100}>
                <ProgressLabel>{words.prize(rule)}</ProgressLabel>
                <ProgressValue>
                  {() =>
                    rule.earnType === "visit"
                      ? t("rewards.visits", { done, goal: rule.goal })
                      : t("rewards.spent", {
                          done: formatPrice(done, place.currency, locale),
                          goal: formatPrice(rule.goal, place.currency, locale),
                        })
                  }
                </ProgressValue>
              </Progress>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </PageSection>
  )
}

// The client's rewards (docs/plans/rewards.md, RW-7), one part per business.
export function RewardsList({
  places,
  addPhone,
}: {
  places: MyRewardsPlace[]
  addPhone: boolean
}) {
  const t = useTranslations("public.account")
  if (places.length === 0) {
    return <AccountEmpty title={t("rewards.none")} addPhone={addPhone} />
  }
  return (
    <div className="flex flex-col gap-8">
      {places.map((place) => (
        <PlaceRewards key={place.business.slug} place={place} />
      ))}
    </div>
  )
}
