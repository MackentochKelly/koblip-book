"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { AppSelect } from "@/components/app-select"
import { PageSection } from "@/components/page-section"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { CreditCardIcon, ExternalLinkIcon } from "@/components/ui/icons"
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
import { Spinner } from "@/components/ui/spinner"
import { formatPrice } from "@/lib/format-price"
import { noAutofill } from "@/lib/no-autofill"
import { parsePrice } from "@/lib/parse-price"
import {
  DEPOSIT_TYPES,
  ONLINE_PAY_MODES,
  ONLINE_PAY_RULES,
  smallestCharge,
  type DepositType,
  type OnlinePayMode,
} from "@/lib/payment-rules"
import type { Plan } from "@/lib/plan-features"
import {
  connectStripeAccount,
  saveOnlinePay,
} from "../api/online-pay-actions"

const CARD_FORM = "card-payments-form"
const STRIPE_DASHBOARD = "https://dashboard.stripe.com"

// Where the business stands: lib/stripe-connect.ts's states, or the plan
// that has card payments when its own does not.
export type CardPaymentsState =
  | { kind: "plan"; plan: Plan }
  | { kind: "none" | "country" | "details" | "ready" }

export interface CardSetting {
  mode: OnlinePayMode
  depositType: DepositType | null
  // A percent, or an amount in hundredths.
  depositValue: number | null
}

// Settings → Payments → Card payments (docs/plans/online-payments.md):
// the business connects its own Stripe account on Stripe's pages, then
// chooses what customers pay by card when they book: nothing, a deposit or
// the full price. The money goes to the business; Koblip never holds it.
export function CardPaymentsSection({
  businessId,
  state,
  setting,
  currency,
}: {
  businessId: string
  state: CardPaymentsState
  setting: CardSetting
  currency: string
}) {
  const c = useTranslations("owner.catalog.common")
  const settings = useTranslations("owner.settings")
  const plans = useTranslations("app.planLocked")
  const t = useTranslations("owner.settings.payments.card")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<"percent" | "amount" | null>(null)
  const connected = state.kind === "details" || state.kind === "ready"

  const connect = () =>
    startTransition(async () => {
      const result = await connectStripeAccount(businessId).catch(() => null)
      if (result?.ok) {
        // Stripe's own pages; the owner comes back here.
        window.location.assign(result.url)
      } else if (result?.error === "country") {
        router.refresh()
      } else {
        toast.error(
          result?.error === "email" ? t("needEmail") : settings("tryAgain")
        )
      }
    })
  const save = (input: { mode: string; type?: string; value?: number }) =>
    startTransition(async () => {
      const result = await saveOnlinePay(businessId, input).catch(() => null)
      if (result?.ok) {
        setEditing(false)
        toast.success(c("saved"))
        router.refresh()
      } else if (result?.error === "percent" || result?.error === "amount") {
        setError(result.error)
      } else {
        toast.error(settings("tryAgain"))
      }
    })

  const summary =
    setting.mode === "full"
      ? t("modes.full")
      : setting.mode === "deposit" && setting.depositValue
        ? setting.depositType === "amount"
          ? t("depositAmount", {
              amount: formatPrice(setting.depositValue, currency, locale),
            })
          : t("depositPercent", { percent: setting.depositValue })
        : t("modes.off")

  return (
    <PageSection
      id="card-payments"
      title={t("title")}
      info={t("info")}
      infoLabel={settings("moreInfo")}
    >
      <ItemGroup className="gap-3">
        <Item variant="outline" role="listitem">
          <ItemMedia variant="icon">
            <CreditCardIcon />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>{t("stripe")}</ItemTitle>
            <ItemDescription>
              {state.kind === "plan"
                ? plans("title", { plan: plans(`plans.${state.plan}`) })
                : t(`state.${state.kind}`)}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {state.kind === "plan" && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/${businessId}/settings/plan`} />
                }
              >
                {plans("seePlans")}
              </Button>
            )}
            {(state.kind === "none" || state.kind === "details") && (
              <Button variant="outline" disabled={pending} onClick={connect}>
                {pending && !editing && <Spinner data-icon="inline-start" />}
                {t(state.kind === "none" ? "connect" : "continue")}
              </Button>
            )}
            {state.kind === "ready" && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={STRIPE_DASHBOARD} target="_blank" rel="noreferrer" />
                }
              >
                {t("open")}
                <ExternalLinkIcon data-icon="inline-end" />
              </Button>
            )}
          </ItemActions>
        </Item>
        {connected && (
          <Item variant="outline" role="listitem">
            <ItemContent className="min-w-0">
              <ItemTitle>{t("pay")}</ItemTitle>
              <ItemDescription>{summary}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                onClick={() => {
                  setFormKey((value) => value + 1)
                  setError(null)
                  setEditing(true)
                }}
              >
                {c("edit")}
              </Button>
            </ItemActions>
          </Item>
        )}
      </ItemGroup>

      <ResponsivePanel
        open={editing}
        onClose={() => setEditing(false)}
        title={t("pay")}
        footer={
          <Button type="submit" size="lg" form={CARD_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {c("save")}
          </Button>
        }
      >
        {editing && (
          <CardForm
            key={formKey}
            setting={setting}
            currency={currency}
            error={error}
            onError={setError}
            onSave={save}
          />
        )}
      </ResponsivePanel>
    </PageSection>
  )
}

// An amount in hundredths as the owner types it: "10" or "10.50".
function amountText(minor: number | null): string {
  if (minor === null) return ""
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}

// What customers pay by card: off, a deposit (a percent or an amount) or
// the full price.
function CardForm({
  setting,
  currency,
  error,
  onError,
  onSave,
}: {
  setting: CardSetting
  currency: string
  error: "percent" | "amount" | null
  onError: (error: "percent" | "amount" | null) => void
  onSave: (input: { mode: string; type?: string; value?: number }) => void
}) {
  const t = useTranslations("owner.settings.payments.card")
  const locale = useLocale()
  const [mode, setMode] = useState<OnlinePayMode>(setting.mode)
  const [type, setType] = useState<DepositType>(
    setting.depositType ?? "percent"
  )
  const [value, setValue] = useState(
    setting.depositValue === null
      ? ""
      : setting.depositType === "amount"
        ? amountText(setting.depositValue)
        : String(setting.depositValue)
  )
  const least = smallestCharge(currency)
  return (
    <form
      id={CARD_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (mode !== "deposit") return onSave({ mode })
        if (type === "percent") {
          const percent = /^\d+$/.test(value.trim()) ? Number(value) : NaN
          if (
            !(
              percent >= ONLINE_PAY_RULES.minPercent &&
              percent <= ONLINE_PAY_RULES.maxPercent
            )
          )
            return onError("percent")
          return onSave({ mode, type, value: percent })
        }
        const amount = parsePrice(value)
        if (!amount || amount < least) return onError("amount")
        onSave({ mode, type, value: amount })
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="card-mode">{t("pay")}</FieldLabel>
          <AppSelect
            id="card-mode"
            options={ONLINE_PAY_MODES.map((item) => ({
              value: item,
              label: t(`modes.${item}`),
            }))}
            value={mode}
            onValueChange={(next) => {
              setMode(next)
              onError(null)
            }}
            className="w-full"
          />
        </Field>
        {mode === "deposit" && (
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="deposit-type">{t("depositType")}</FieldLabel>
              <AppSelect
                id="deposit-type"
                options={DEPOSIT_TYPES.map((item) => ({
                  value: item,
                  label: t(`types.${item}`),
                }))}
                value={type}
                onValueChange={(next) => {
                  setType(next)
                  setValue("")
                  onError(null)
                }}
                className="w-full"
              />
            </Field>
            <Field data-invalid={error !== null || undefined}>
              <FieldLabel htmlFor="deposit-value">
                {t(`types.${type}`)}
              </FieldLabel>
              <Input
                {...noAutofill("deposit_value")}
                id="deposit-value"
                className="min-h-11 md:min-h-9"
                inputMode={type === "percent" ? "numeric" : "decimal"}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  onError(null)
                }}
                aria-invalid={error !== null || undefined}
              />
              {error === "percent" && (
                <FieldError>
                  {t("usePercent", {
                    min: ONLINE_PAY_RULES.minPercent,
                    max: ONLINE_PAY_RULES.maxPercent,
                  })}
                </FieldError>
              )}
              {error === "amount" && (
                <FieldError>
                  {t("useAmount", {
                    amount: formatPrice(least, currency, locale),
                  })}
                </FieldError>
              )}
            </Field>
          </div>
        )}
      </FieldGroup>
    </form>
  )
}
