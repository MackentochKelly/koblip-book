"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { ChevronDownIcon, GiftIcon } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useRewardWords } from "@/hooks/use-reward-words"
import { formatDay } from "@/lib/format-booking-time"
import { formatPrice } from "@/lib/format-price"
import { noAutofill } from "@/lib/no-autofill"
import { parsePrice } from "@/lib/parse-price"
import { REWARD_RULES, type RewardRule } from "@/lib/reward-rules"
import {
  changeCustomerProgress,
  giveCustomerReward,
} from "../api/customer-reward-actions"
import type { OwnerCustomerRewards } from "../types"

// A change by hand the owner is making for one customer on one rule.
export interface RewardChange {
  rule: RewardRule
  mode: "add" | "remove" | "give"
}

// What a change is called: on its menu line and as its form's title.
export function useRewardChangeTitle() {
  const t = useTranslations("owner.rewards.customer")
  return ({ rule, mode }: RewardChange) => {
    if (mode === "give") return t("give")
    const visits = rule.earnType === "visit"
    if (mode === "add") return t(visits ? "addVisits" : "addAmount")
    return t(visits ? "removeVisits" : "removeAmount")
  }
}

// One customer's rewards in their panel (docs/plans/rewards.md, RW-8):
// what they can redeem, where they are on each rule (with the changes by
// hand behind its menu), and the latest history.
export function CustomerRewards({
  rewards,
  currency,
  onChange,
}: {
  rewards: OwnerCustomerRewards
  currency: string
  onChange: (change: RewardChange) => void
}) {
  const t = useTranslations("owner.rewards")
  const c = useTranslations("owner.catalog.common")
  const locale = useLocale()
  const words = useRewardWords(currency)
  const title = useRewardChangeTitle()
  const amount = (rule: RewardRule | undefined, value: number) =>
    rule?.earnType === "spend"
      ? formatPrice(value, currency, locale)
      : String(value)
  const ruleOf = (id: string) =>
    rewards.rules.find((item) => item.rule.id === id)?.rule
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{t("title")}</p>
      <ItemGroup>
        {rewards.rewards.map((reward) => (
          <Item key={reward.id} size="sm" className="px-0">
            <ItemMedia variant="icon">
              <GiftIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{words.reward(reward.reward)}</ItemTitle>
              {(reward.held || reward.expires) && (
                <ItemDescription>
                  {reward.held
                    ? t("customer.held")
                    : t("customer.expires", {
                        day: formatDay(reward.expires ?? "", locale),
                      })}
                </ItemDescription>
              )}
            </ItemContent>
          </Item>
        ))}
        {rewards.rules.map(({ rule, balance }) => (
          <Item key={rule.id} size="sm" className="px-0">
            <ItemContent>
              <ItemTitle>{words.prize(rule)}</ItemTitle>
              <ItemDescription>
                {rule.earnType === "visit"
                  ? t("customer.visits", { done: balance, goal: rule.goal })
                  : t("customer.spent", {
                      done: formatPrice(balance, currency, locale),
                      goal: formatPrice(rule.goal, currency, locale),
                    })}
              </ItemDescription>
            </ItemContent>
            {rule.status !== "ended" && (
              <ItemActions>
                <DropdownMenu>
                  <MoreMenuTrigger label={c("more")} />
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      {(["add", "remove", "give"] as const).map((mode) => (
                        <DropdownMenuItem
                          key={mode}
                          onClick={() => onChange({ rule, mode })}
                        >
                          {title({ rule, mode })}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            )}
          </Item>
        ))}
      </ItemGroup>
      {rewards.history.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button type="button" variant="ghost" className="group">
                {t("customer.history")}
                <ChevronDownIcon
                  data-icon="inline-end"
                  className="transition-transform group-data-[panel-open]:rotate-180"
                />
              </Button>
            }
          />
          <CollapsibleContent>
            <ItemGroup>
              {rewards.history.map((event) => {
                // A reward given by hand moves no count; a convert that
                // adds back is a reward taken back.
                const type =
                  event.type === "adjust" && event.amount === 0
                    ? "given"
                    : event.type === "convert" && event.amount > 0
                      ? "unconvert"
                      : event.type
                const counted = event.type !== "convert" && event.amount !== 0
                return (
                  <Item key={event.id} size="sm" className="px-0">
                    <ItemContent>
                      <ItemTitle>{t(`customer.types.${type}`)}</ItemTitle>
                      <ItemDescription>
                        {[formatDay(event.date, locale), event.note]
                          .filter(Boolean)
                          .join(" · ")}
                      </ItemDescription>
                    </ItemContent>
                    {counted && (
                      <ItemActions className="text-muted-foreground tabular-nums">
                        {event.amount > 0 && "+"}
                        {amount(ruleOf(event.ruleId), event.amount)}
                      </ItemActions>
                    )}
                  </Item>
                )
              })}
            </ItemGroup>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

export const REWARD_CHANGE_FORM = "reward-change-form"

// The form for one change by hand: how much (not when giving a reward)
// and why. Its Save button is the panel's (form={REWARD_CHANGE_FORM}).
export function RewardChangeForm({
  businessId,
  customerKey,
  change,
  onPending,
  onDone,
}: {
  businessId: string
  customerKey: string
  change: RewardChange
  onPending: (pending: boolean) => void
  onDone: () => void
}) {
  const t = useTranslations("owner.rewards")
  const c = useTranslations("owner.catalog.common")
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<"amount" | "note" | null>(null)
  const [, startTransition] = useTransition()
  const { rule, mode } = change
  const visits = rule.earnType === "visit"

  const save = () => {
    let value = 0
    if (mode !== "give") {
      const typed = visits
        ? /^\d+$/.test(amount.trim())
          ? Number(amount.trim())
          : undefined
        : parsePrice(amount)
      if (!typed) return setError("amount")
      value = mode === "add" ? typed : -typed
    }
    if (!note.trim()) return setError("note")
    setError(null)
    onPending(true)
    startTransition(async () => {
      const input = { ruleId: rule.id, customerKey, note: note.trim() }
      const result = await (
        mode === "give"
          ? giveCustomerReward(businessId, input)
          : changeCustomerProgress(businessId, { ...input, amount: value })
      ).catch(() => null)
      onPending(false)
      if (result?.ok) {
        toast.success(mode === "give" ? t("customer.given") : c("saved"))
        onDone()
        router.refresh()
      } else if (result?.error === "amount" || result?.error === "note") {
        setError(result.error)
      } else {
        toast.error(c("failed"))
      }
    })
  }

  return (
    <form
      id={REWARD_CHANGE_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <FieldGroup>
        {mode !== "give" && (
          <Field data-invalid={error === "amount" || undefined}>
            <FieldLabel htmlFor="reward-change-amount">
              {t(visits ? "customer.count" : "customer.amount")}
            </FieldLabel>
            <Input
              {...noAutofill("reward_change_amount")}
              id="reward-change-amount"
              inputMode={visits ? "numeric" : "decimal"}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={error === "amount" || undefined}
            />
            {error === "amount" && (
              <FieldError>{t("form.useNumber")}</FieldError>
            )}
          </Field>
        )}
        <Field data-invalid={error === "note" || undefined}>
          <FieldLabel htmlFor="reward-change-note">
            {t("customer.reason")}
          </FieldLabel>
          <Input
            {...noAutofill("reward_change_note")}
            id="reward-change-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={REWARD_RULES.maxNote}
            aria-invalid={error === "note" || undefined}
          />
          {error === "note" && (
            <FieldError>{t("customer.addReason")}</FieldError>
          )}
        </Field>
      </FieldGroup>
    </form>
  )
}
