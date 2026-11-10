import type { createTranslator, Messages } from "next-intl"

import { formatPrice } from "./format-price"
import type { RewardCopy, RewardRule, RewardServices } from "./reward-rules"

// The app.rewards words, from useTranslations or getTranslations.
export type RewardWordsText = ReturnType<
  typeof createTranslator<Messages, "app.rewards">
>

// A reward rule in words, the same everywhere it shows: what the customer
// gets ("Free Haircut", "20% off", "2 × Free Haircut") and what earns it
// ("Every 5 visits", "Every $300.00 spent: Haircut or Color"). A component
// uses useRewardWords (hooks/use-reward-words.ts).
export function rewardWords(
  t: RewardWordsText,
  locale: string,
  currency: string
) {
  const names = (services: RewardServices) =>
    services === null
      ? null
      : new Intl.ListFormat(locale, { type: "disjunction" }).format(
          services.map((service) => service.name)
        )
  const money = (minor: number) => formatPrice(minor, currency, locale)

  // What one use of the reward gives.
  const reward = (copy: RewardCopy): string => {
    const service = names(copy.services)
    if (copy.type === "free") {
      return service ? t("free", { service }) : t("freeAny")
    }
    if (copy.type === "percent") {
      const percent = copy.value ?? 0
      return service
        ? t("percent", { percent, service })
        : t("percentAny", { percent })
    }
    const amount = money(copy.value ?? 0)
    return service
      ? t("amount", { amount, service })
      : t("amountAny", { amount })
  }

  // What reaching the goal gives: the reward, times the bookings it covers.
  const prize = (
    rule: Pick<
      RewardRule,
      | "rewardType"
      | "rewardValue"
      | "rewardCount"
      | "rewardServices"
      | "maxDiscountMinor"
    >
  ): string => {
    const one = reward({
      type: rule.rewardType,
      value: rule.rewardValue,
      maxDiscountMinor: rule.maxDiscountMinor,
      services: rule.rewardServices,
    })
    return rule.rewardCount > 1
      ? t("times", { count: rule.rewardCount, reward: one })
      : one
  }

  // What earns it.
  const earn = (
    rule: Pick<RewardRule, "earnType" | "goal" | "earnServices">
  ): string => {
    const service = names(rule.earnServices)
    if (rule.earnType === "visit") {
      return service
        ? t("visitsOf", { count: rule.goal, service })
        : t("visits", { count: rule.goal })
    }
    const amount = money(rule.goal)
    return service ? t("spendOf", { amount, service }) : t("spend", { amount })
  }

  return { reward, prize, earn }
}
