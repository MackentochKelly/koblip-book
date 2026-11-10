"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { AppSelect } from "@/components/app-select"
import { DatePicker } from "@/components/date-picker"
import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { PageSection } from "@/components/page-section"
import { ResponsivePanel } from "@/components/responsive-panel"
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
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  ChevronDownIcon,
  GiftIcon,
  PlusIcon,
  SquarePenIcon,
  Trash2Icon,
} from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useRewardWords } from "@/hooks/use-reward-words"
import { todayIn } from "@/lib/format-booking-time"
import { noAutofill } from "@/lib/no-autofill"
import { parsePrice } from "@/lib/parse-price"
import {
  REWARD_EARN_TYPES,
  REWARD_RULES,
  REWARD_TYPES,
  rewardLastDay,
  type RewardEarnType,
  type RewardRule,
  type RewardRuleForm,
  type RewardType,
} from "@/lib/reward-rules"
import {
  removeRewardRule,
  saveRewardRule,
  setRewardRuleOn,
} from "../api/reward-actions"
import { ConfirmRemove } from "./confirm-remove"

const RULE_FORM = "reward-rule-form"

type ServiceOption = { id: string; name: string }
type FormError =
  | "goal"
  | "rewardValue"
  | "rewardCount"
  | "expiresDays"
  | "maxPerCustomer"
  | "maxDiscount"
  | "earnMinPrice"
  | "endsOn"

// Rewards (docs/plans/rewards.md): the business's reward rules, each a
// row with its switch and its Edit and Remove, and one action, Add reward.
// Customers earn by booking; Koblip never moves money, a reward only
// lowers the price a booking shows.
export function RewardsView({
  businessId,
  currency,
  rules,
  services,
  timeZone,
  tracksPayments,
}: {
  businessId: string
  currency: string
  // The business's own: a reward's last day is a day there.
  timeZone: string
  rules: RewardRule[]
  services: ServiceOption[]
  // The business lists a way to pay, so "only paid bookings count" means
  // something.
  tracksPayments: boolean
}) {
  const c = useTranslations("owner.catalog.common")
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.rewards")
  const words = useRewardWords(currency)
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // null: closed. "new": a new rule. Else the rule being changed.
  const [editing, setEditing] = useState<RewardRule | "new" | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<FormError | null>(null)
  const [removing, setRemoving] = useState<RewardRule | null>(null)
  const full = rules.length >= REWARD_RULES.maxRules

  const open = (next: RewardRule | "new") => {
    setFormKey((value) => value + 1)
    setError(null)
    setEditing(next)
  }
  const save = (input: RewardRuleForm) => {
    if (editing === null) return
    startTransition(async () => {
      const result = await saveRewardRule(
        businessId,
        editing === "new" ? null : editing.id,
        input
      ).catch(() => null)
      if (result?.ok) {
        setEditing(null)
        toast.success(c("saved"))
        router.refresh()
      } else if (result?.error === "full") {
        toast.error(t("full"))
      } else if (result?.error === "endsAt") {
        setError("endsOn")
      } else {
        toast.error(settings("tryAgain"))
      }
    })
  }
  const toggle = (rule: RewardRule, on: boolean) =>
    startTransition(async () => {
      const result = await setRewardRuleOn(businessId, rule.id, on).catch(
        () => null
      )
      if (result?.ok) router.refresh()
      else toast.error(settings("tryAgain"))
    })
  const remove = (rule: RewardRule) =>
    startTransition(async () => {
      const result = await removeRewardRule(businessId, rule.id).catch(
        () => null
      )
      if (result?.ok) {
        setEditing(null)
        toast.success(t("removed"))
        router.refresh()
      } else {
        toast.error(settings("tryAgain"))
      }
    })

  const add = (
    <Button disabled={full || pending} onClick={() => open("new")}>
      <PlusIcon data-icon="inline-start" />
      {t("add")}
    </Button>
  )

  return (
    <PageSection
      id="rewards"
      title={t("title")}
      info={t("info")}
      infoLabel={settings("moreInfo")}
      // With no reward yet, the empty state holds the one action.
      action={rules.length > 0 ? add : undefined}
    >
      {rules.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GiftIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty")}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>{add}</EmptyContent>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {rules.map((rule) => {
            const name = words.prize(rule)
            return (
              <Item key={rule.id} variant="outline" role="listitem">
                <ItemContent className="min-w-0">
                  <ItemTitle>{name}</ItemTitle>
                  <ItemDescription>{words.earn(rule)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Switch
                    checked={rule.status === "active"}
                    onCheckedChange={(on) => toggle(rule, on)}
                    disabled={pending}
                    aria-label={t("turnOn", { name })}
                  />
                  <DropdownMenu>
                    <MoreMenuTrigger label={c("more")} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => open(rule)}>
                          <SquarePenIcon />
                          {c("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={pending}
                          onClick={() => setRemoving(rule)}
                        >
                          <Trash2Icon />
                          {c("remove")}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      )}

      <ConfirmRemove
        name={removing ? words.prize(removing) : null}
        description={t("removeHint")}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing === null || editing === "new"
            ? t("new")
            : words.prize(editing)
        }
        footer={
          <Button type="submit" size="lg" form={RULE_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {c("save")}
          </Button>
        }
      >
        {editing !== null && (
          <RuleForm
            key={formKey}
            rule={editing === "new" ? null : editing}
            services={services}
            timeZone={timeZone}
            tracksPayments={tracksPayments}
            error={error}
            onError={setError}
            onSave={save}
          />
        )}
      </ResponsivePanel>
    </PageSection>
  )
}

// Minor units as the owner types them: 2500 → "25", 2550 → "25.50".
function priceText(minor: number | null): string {
  if (minor === null) return ""
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}

// "" → null (no limit); a whole number in range → it; else undefined.
function wholeOrNone(text: string, max: number): number | null | undefined {
  const value = text.trim()
  if (!value) return null
  if (!/^\d+$/.test(value)) return undefined
  const number = Number(value)
  return number >= 1 && number <= max ? number : undefined
}

// One rule: what earns, the goal, the reward, and its limits under More
// options. Every field is checked again on the server (checkRewardRule).
function RuleForm({
  rule,
  services,
  timeZone,
  tracksPayments,
  error,
  onError,
  onSave,
}: {
  rule: RewardRule | null
  services: ServiceOption[]
  timeZone: string
  tracksPayments: boolean
  error: FormError | null
  onError: (error: FormError | null) => void
  onSave: (input: RewardRuleForm) => void
}) {
  const t = useTranslations("owner.rewards.form")
  const locale = useLocale()
  const [earnType, setEarnType] = useState<RewardEarnType>(
    rule?.earnType ?? "visit"
  )
  const [goal, setGoal] = useState(
    rule
      ? rule.earnType === "visit"
        ? String(rule.goal)
        : priceText(rule.goal)
      : "5"
  )
  const [earnServiceIds, setEarnServiceIds] = useState<string[]>(
    rule?.earnServices?.map((service) => service.id) ?? []
  )
  const [rewardType, setRewardType] = useState<RewardType>(
    rule?.rewardType ?? "free"
  )
  const [value, setValue] = useState(
    rule?.rewardValue == null
      ? ""
      : rule.rewardType === "percent"
        ? String(rule.rewardValue)
        : priceText(rule.rewardValue)
  )
  const [rewardServiceIds, setRewardServiceIds] = useState<string[]>(
    rule?.rewardServices?.map((service) => service.id) ?? []
  )
  const [count, setCount] = useState(String(rule?.rewardCount ?? 1))
  const [expires, setExpires] = useState(
    rule?.expiresDays == null ? "" : String(rule.expiresDays)
  )
  const [perCustomer, setPerCustomer] = useState(
    rule?.maxPerCustomer == null ? "" : String(rule.maxPerCustomer)
  )
  const [maxDiscount, setMaxDiscount] = useState(
    priceText(rule?.maxDiscountMinor ?? null)
  )
  const [minPrice, setMinPrice] = useState(
    priceText(rule?.earnMinPriceMinor ?? null)
  )
  const [paidOnly, setPaidOnly] = useState(rule?.paidOnly ?? false)
  const [endsOn, setEndsOn] = useState(
    rewardLastDay(rule?.endsAt ?? null, timeZone) ?? ""
  )

  const serviceOptions = services.map((service) => ({
    value: service.id,
    label: service.name,
  }))
  const changed = () => onError(null)

  const submit = () => {
    const goalNumber =
      earnType === "visit"
        ? wholeOrNone(goal, REWARD_RULES.maxGoalVisits)
        : parsePrice(goal)
    if (!goalNumber) return onError("goal")
    let rewardValue: number | null = null
    if (rewardType === "percent") {
      const percent = wholeOrNone(value, 100)
      if (!percent) return onError("rewardValue")
      rewardValue = percent
    } else if (rewardType === "amount") {
      const amount = parsePrice(value)
      if (!amount) return onError("rewardValue")
      rewardValue = amount
    }
    const rewardCount = wholeOrNone(count, REWARD_RULES.maxCount)
    if (!rewardCount) return onError("rewardCount")
    const expiresDays = wholeOrNone(expires, REWARD_RULES.maxExpiresDays)
    if (expiresDays === undefined) return onError("expiresDays")
    const maxPerCustomer = wholeOrNone(perCustomer, REWARD_RULES.maxPerCustomer)
    if (maxPerCustomer === undefined) return onError("maxPerCustomer")
    const maxDiscountMinor =
      rewardType === "amount" ? null : parsePrice(maxDiscount)
    if (maxDiscountMinor === undefined || maxDiscountMinor === 0) {
      return onError("maxDiscount")
    }
    const earnMinPriceMinor = parsePrice(minPrice)
    if (earnMinPriceMinor === undefined || earnMinPriceMinor === 0) {
      return onError("earnMinPrice")
    }
    onSave({
      earnType,
      earnServiceIds: earnServiceIds.length > 0 ? earnServiceIds : null,
      earnMinPriceMinor,
      goal: goalNumber,
      rewardType,
      rewardValue,
      rewardCount,
      rewardServiceIds: rewardServiceIds.length > 0 ? rewardServiceIds : null,
      maxDiscountMinor,
      expiresDays,
      endsOn: endsOn === "" ? null : endsOn,
      maxPerCustomer,
      paidOnly: tracksPayments && paidOnly,
    })
  }

  return (
    <form
      id={RULE_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="reward-earn">{t("earn")}</FieldLabel>
            <AppSelect
              id="reward-earn"
              options={REWARD_EARN_TYPES.map((type) => ({
                value: type,
                label: t(`earnTypes.${type}`),
              }))}
              value={earnType}
              onValueChange={(next) => {
                setEarnType(next)
                setGoal(next === "visit" ? "5" : "")
                changed()
              }}
              className="w-full"
            />
          </Field>
          <Field data-invalid={error === "goal" || undefined}>
            <FieldLabel htmlFor="reward-goal">
              {t(earnType === "visit" ? "goalVisit" : "goalSpend")}
            </FieldLabel>
            <Input
              {...noAutofill("reward_goal")}
              id="reward-goal"
              inputMode={earnType === "visit" ? "numeric" : "decimal"}
              value={goal}
              onChange={(event) => {
                setGoal(event.target.value)
                changed()
              }}
              aria-invalid={error === "goal" || undefined}
            />
            {error === "goal" && <FieldError>{t("useNumber")}</FieldError>}
          </Field>
        </div>
        {services.length > 1 && (
          <Field>
            <FieldLabel htmlFor="reward-earn-services">
              {t("earnServices")}
            </FieldLabel>
            <AppSelect
              multiple
              id="reward-earn-services"
              options={serviceOptions}
              value={earnServiceIds}
              onValueChange={setEarnServiceIds}
              placeholder={t("allServices")}
              className="w-full"
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field className={rewardType === "free" ? "col-span-2" : undefined}>
            <FieldLabel htmlFor="reward-type">{t("reward")}</FieldLabel>
            <AppSelect
              id="reward-type"
              options={REWARD_TYPES.map((type) => ({
                value: type,
                label: t(`rewardTypes.${type}`),
              }))}
              value={rewardType}
              onValueChange={(next) => {
                setRewardType(next)
                setValue("")
                changed()
              }}
              className="w-full"
            />
          </Field>
          {rewardType !== "free" && (
            <Field data-invalid={error === "rewardValue" || undefined}>
              <FieldLabel htmlFor="reward-value">
                {t(rewardType === "percent" ? "percent" : "amount")}
              </FieldLabel>
              <Input
                {...noAutofill("reward_value")}
                id="reward-value"
                inputMode={rewardType === "percent" ? "numeric" : "decimal"}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  changed()
                }}
                aria-invalid={error === "rewardValue" || undefined}
              />
              {error === "rewardValue" && (
                <FieldError>
                  {t(rewardType === "percent" ? "usePercent" : "useNumber")}
                </FieldError>
              )}
            </Field>
          )}
        </div>
        {services.length > 1 && (
          <Field>
            <FieldLabel htmlFor="reward-services">
              {t("rewardServices")}
            </FieldLabel>
            <AppSelect
              multiple
              id="reward-services"
              options={serviceOptions}
              value={rewardServiceIds}
              onValueChange={setRewardServiceIds}
              placeholder={t("allServices")}
              className="w-full"
            />
          </Field>
        )}
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button type="button" variant="ghost" className="group">
                {t("more")}
                <ChevronDownIcon
                  data-icon="inline-end"
                  className="transition-transform group-data-[panel-open]:rotate-180"
                />
              </Button>
            }
          />
          <CollapsibleContent>
            <FieldGroup className="pt-3">
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  id="reward-count"
                  label={t("count")}
                  value={count}
                  onChange={(next) => {
                    setCount(next)
                    changed()
                  }}
                  error={error === "rewardCount" ? t("useNumber") : null}
                />
                <NumberField
                  id="reward-expires"
                  label={t("expires")}
                  placeholder={t("noLimit")}
                  value={expires}
                  onChange={(next) => {
                    setExpires(next)
                    changed()
                  }}
                  error={error === "expiresDays" ? t("useNumber") : null}
                />
                <NumberField
                  id="reward-per-customer"
                  label={t("maxPerCustomer")}
                  placeholder={t("noLimit")}
                  value={perCustomer}
                  onChange={(next) => {
                    setPerCustomer(next)
                    changed()
                  }}
                  error={error === "maxPerCustomer" ? t("useNumber") : null}
                />
                {rewardType !== "amount" && (
                  <NumberField
                    id="reward-max-discount"
                    label={t("maxDiscount")}
                    placeholder={t("noLimit")}
                    decimal
                    value={maxDiscount}
                    onChange={(next) => {
                      setMaxDiscount(next)
                      changed()
                    }}
                    error={error === "maxDiscount" ? t("useNumber") : null}
                  />
                )}
                <NumberField
                  id="reward-min-price"
                  label={t("minPrice")}
                  placeholder={t("noLimit")}
                  decimal
                  value={minPrice}
                  onChange={(next) => {
                    setMinPrice(next)
                    changed()
                  }}
                  error={error === "earnMinPrice" ? t("useNumber") : null}
                />
                <Field data-invalid={error === "endsOn" || undefined}>
                  <FieldLabel htmlFor="reward-ends">{t("endsOn")}</FieldLabel>
                  <DatePicker
                    id="reward-ends"
                    value={endsOn}
                    min={todayIn(timeZone)}
                    onChange={(next) => {
                      setEndsOn(next)
                      changed()
                    }}
                    locale={locale}
                    placeholder={t("never")}
                    invalid={error === "endsOn"}
                  />
                  {error === "endsOn" && (
                    <FieldError>{t("pickLater")}</FieldError>
                  )}
                </Field>
              </div>
              {tracksPayments && (
                <Field orientation="horizontal" className="min-h-11">
                  <FieldContent>
                    <FieldLabel htmlFor="reward-paid-only">
                      {t("paidOnly")}
                    </FieldLabel>
                  </FieldContent>
                  <Switch
                    id="reward-paid-only"
                    checked={paidOnly}
                    onCheckedChange={setPaidOnly}
                  />
                </Field>
              )}
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>
    </form>
  )
}

// One number of the limits: whole, or money when `decimal`.
function NumberField({
  id,
  label,
  placeholder,
  decimal,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  placeholder?: string
  decimal?: boolean
  value: string
  onChange: (value: string) => void
  error: string | null
}) {
  return (
    <Field data-invalid={error !== null || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        {...noAutofill(id.replaceAll("-", "_"))}
        id={id}
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error !== null || undefined}
      />
      {error !== null && <FieldError>{error}</FieldError>}
    </Field>
  )
}
