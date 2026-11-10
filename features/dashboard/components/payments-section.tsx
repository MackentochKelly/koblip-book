"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { PageSection } from "@/components/page-section"
import { PaymentTypeIcon } from "@/components/payment-type-icon"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { CircleAlertIcon, PlusIcon, Trash2Icon } from "@/components/ui/icons"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { noAutofill } from "@/lib/no-autofill"
import {
  PAYMENT_RULES,
  PAYMENT_START_NAMES,
  PAYMENT_TYPES,
  paymentSlots,
  type PaymentMethod,
  type PaymentType,
} from "@/lib/payment-rules"
import {
  deletePaymentMethod,
  keepPolicies,
  removePaymentType,
  savePaymentMethod,
  setPayLater,
  setPaymentProof,
} from "../api/payment-actions"
import { ConfirmRemove } from "./confirm-remove"

const METHOD_FORM = "payment-method-form"

type Editing = { method: PaymentMethod | null; type: PaymentType }

// Settings → Payments: the ways the business is paid outside the app, and
// whether customers may pay at the visit. Every business starts with the
// standard ways listed (bank transfer, Zelle, Cash App), each waiting for
// where to send the money; a way reaches customers once it has that. Any
// way can be removed, a standard one too, and added again with Add. With
// none set up, booking has no payment step. Koblip never moves the money;
// the owner marks each booking paid (booking-details.tsx). When the ways
// to pay moved on from what the policies say, the first row offers to
// bring the policies up to date; nothing in them changes without that tap.
export function PaymentsSection({
  businessId,
  methods,
  payLater,
  removedTypes,
  asksProof,
  teamSeesProof,
  policiesOutOfDate,
  onUpdatePolicies,
}: {
  businessId: string
  methods: PaymentMethod[]
  payLater: boolean
  removedTypes: PaymentType[]
  // Payment pictures (docs/plans/payment-proof.md): asked for, and shown
  // to the team member a booking is with.
  asksProof: boolean
  teamSeesProof: boolean
  policiesOutOfDate: boolean
  // Rewrites what the policies say about paying; the page passes it in,
  // as the policy writer is another feature's.
  onUpdatePolicies: (
    businessId: string
  ) => Promise<{ ok: true; changed: number } | { ok: false }>
}) {
  const c = useTranslations("owner.catalog.common")
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.payments")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [removing, setRemoving] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState<"name" | "details" | null>(null)
  const [askUpdate, setAskUpdate] = useState(false)
  const full = methods.length >= PAYMENT_RULES.maxMethods
  const { standard, more } = paymentSlots(methods, removedTypes)

  const open = (next: Editing) => {
    setFormKey((value) => value + 1)
    setError(null)
    setEditing(next)
  }
  const save = (input: { name: string; details: string }) => {
    if (!editing) return
    startTransition(async () => {
      const result = await savePaymentMethod(
        businessId,
        editing.method?.id ?? null,
        { type: editing.type, ...input }
      ).catch(() => null)
      if (result?.ok) {
        setEditing(null)
        toast.success(c("saved"))
        router.refresh()
      } else if (result?.error === "name" || result?.error === "details") {
        setError(result.error)
      } else {
        toast.error(settings("tryAgain"))
      }
    })
  }
  const remove = (method: PaymentMethod) =>
    startTransition(async () => {
      const result = await deletePaymentMethod(businessId, method.id).catch(
        () => null
      )
      if (result?.ok) {
        toast.success(t("removed", { name: method.name }))
        router.refresh()
      } else {
        toast.error(settings("tryAgain"))
      }
    })
  // A standard way with nothing in it yet: nothing to lose, so no question.
  const removeType = (type: PaymentType) =>
    startTransition(async () => {
      const result = await removePaymentType(businessId, type).catch(
        () => null
      )
      if (result?.ok) {
        toast.success(t("removed", { name: t(`types.${type}`) }))
        router.refresh()
      } else {
        toast.error(settings("tryAgain"))
      }
    })
  const toggleLater = (next: boolean) =>
    startTransition(async () => {
      const result = await setPayLater(businessId, next).catch(() => null)
      if (result?.ok) router.refresh()
      else toast.error(settings("tryAgain"))
    })

  const toggleProof = (setting: "ask" | "team", next: boolean) =>
    startTransition(async () => {
      const result = await setPaymentProof(businessId, setting, next).catch(
        () => null
      )
      if (result?.ok) router.refresh()
      else toast.error(settings("tryAgain"))
    })
  const updatePolicies = () =>
    startTransition(async () => {
      const result = await onUpdatePolicies(businessId).catch(() => null)
      if (result?.ok) {
        toast.success(
          t(result.changed > 0 ? "policies.updated" : "policies.nothing")
        )
        router.refresh()
      } else {
        toast.error(settings("tryAgain"))
      }
    })
  const keepAsIs = () =>
    startTransition(async () => {
      const result = await keepPolicies(businessId).catch(() => null)
      if (result?.ok) router.refresh()
      else toast.error(settings("tryAgain"))
    })

  // Add opens a choice of kinds, then that kind's form.
  const add = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button disabled={full || pending}>
            <PlusIcon data-icon="inline-start" />
            {c("add")}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {PAYMENT_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => open({ method: null, type })}
            >
              <PaymentTypeIcon type={type} />
              {t(`types.${type}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <PageSection
      id="payments"
      title={t("title")}
      info={t("info")}
      infoLabel={settings("moreInfo")}
      action={add}
    >
      <ItemGroup className="gap-3">
        {policiesOutOfDate && (
          <Item variant="muted" role="listitem">
            <ItemMedia variant="icon">
              <CircleAlertIcon />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>{t("policies.title")}</ItemTitle>
              <ItemDescription>{t("policies.hint")}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setAskUpdate(true)}
              >
                {pending && <Spinner data-icon="inline-start" />}
                {t("policies.update")}
              </Button>
              <DropdownMenu>
                <MoreMenuTrigger label={c("more")} />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem disabled={pending} onClick={keepAsIs}>
                      {t("policies.keep")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ItemActions>
          </Item>
        )}
        {standard.map(({ type, method }) =>
          method ? (
            <MethodRow
              key={method.id}
              method={method}
              pending={pending}
              onEdit={() => open({ method, type: method.type })}
              onRemove={() => setRemoving(method)}
            />
          ) : (
            <Item key={type} variant="outline" role="listitem">
              <ItemMedia variant="icon">
                <PaymentTypeIcon type={type} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>{t(`types.${type}`)}</ItemTitle>
                <ItemDescription>{t("notSetUp")}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  disabled={full || pending}
                  onClick={() => open({ method: null, type })}
                >
                  {t("setUp")}
                </Button>
                <RemoveMenu
                  pending={pending}
                  onRemove={() => removeType(type)}
                />
              </ItemActions>
            </Item>
          )
        )}
        {more.map((method) => (
          <MethodRow
            key={method.id}
            method={method}
            pending={pending}
            onEdit={() => open({ method, type: method.type })}
            onRemove={() => setRemoving(method)}
          />
        ))}
        {methods.length > 0 && (
          <Item variant="outline" role="listitem">
            <Field orientation="horizontal" className="min-h-11">
              <FieldContent>
                <FieldLabel htmlFor="pay-later">{t("payLater")}</FieldLabel>
                <FieldDescription>{t("payLaterHint")}</FieldDescription>
              </FieldContent>
              <Switch
                id="pay-later"
                checked={payLater}
                onCheckedChange={toggleLater}
                disabled={pending}
              />
            </Field>
          </Item>
        )}
        {methods.length > 0 && (
          <Item variant="outline" role="listitem">
            <Field orientation="horizontal" className="min-h-11">
              <FieldContent>
                <FieldLabel htmlFor="ask-proof">{t("proof.ask")}</FieldLabel>
                <FieldDescription>
                  {t("proof.askHint", { days: PAYMENT_RULES.proofKeepDays })}
                </FieldDescription>
              </FieldContent>
              <Switch
                id="ask-proof"
                checked={asksProof}
                onCheckedChange={(next) => toggleProof("ask", next)}
                disabled={pending}
              />
            </Field>
          </Item>
        )}
        {methods.length > 0 && asksProof && (
          <Item variant="outline" role="listitem">
            <Field orientation="horizontal" className="min-h-11">
              <FieldContent>
                <FieldLabel htmlFor="team-proof">{t("proof.team")}</FieldLabel>
                <FieldDescription>{t("proof.teamHint")}</FieldDescription>
              </FieldContent>
              <Switch
                id="team-proof"
                checked={teamSeesProof}
                onCheckedChange={(next) => toggleProof("team", next)}
                disabled={pending}
              />
            </Field>
          </Item>
        )}
      </ItemGroup>

      <ConfirmRemove
        name={removing?.name ?? null}
        description={t("removeHint")}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />

      <ConfirmDialog
        open={askUpdate}
        title={t("policies.confirmTitle")}
        description={t("policies.confirmText")}
        confirm={t("policies.update")}
        cancel={t("policies.cancel")}
        tone="default"
        onConfirm={updatePolicies}
        onClose={() => setAskUpdate(false)}
      />

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? t(`types.${editing.type}`) : ""}
        footer={
          <Button type="submit" size="lg" form={METHOD_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {c("save")}
          </Button>
        }
      >
        {editing !== null && (
          <MethodForm
            key={formKey}
            editing={editing}
            error={error}
            onError={setError}
            onSave={save}
          />
        )}
      </ResponsivePanel>
    </PageSection>
  )
}

// One way the business has set up: its name, where to send the money, and
// its Edit and Remove.
function MethodRow({
  method,
  pending,
  onEdit,
  onRemove,
}: {
  method: PaymentMethod
  pending: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const c = useTranslations("owner.catalog.common")
  return (
    <Item variant="outline" role="listitem">
      <ItemMedia variant="icon">
        <PaymentTypeIcon type={method.type} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>{method.name}</ItemTitle>
        <ItemDescription className="break-words whitespace-pre-line">
          {method.details}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" onClick={onEdit}>
          {c("edit")}
        </Button>
        <RemoveMenu pending={pending} onRemove={onRemove} />
      </ItemActions>
    </Item>
  )
}

// A row's "more" menu, with its Remove: every way can be removed, set up
// or not.
function RemoveMenu({
  pending,
  onRemove,
}: {
  pending: boolean
  onRemove: () => void
}) {
  const c = useTranslations("owner.catalog.common")
  return (
    <DropdownMenu>
      <MoreMenuTrigger label={c("more")} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={onRemove}
          >
            <Trash2Icon />
            {c("remove")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// One way's name and where to send the money.
function MethodForm({
  editing,
  error,
  onError,
  onSave,
}: {
  editing: Editing
  error: "name" | "details" | null
  onError: (error: "name" | "details" | null) => void
  onSave: (input: { name: string; details: string }) => void
}) {
  const c = useTranslations("owner.catalog.common")
  const t = useTranslations("owner.settings.payments")
  // A brand is its own name; a bank or another way is named by the owner.
  const [name, setName] = useState(
    editing.method?.name ?? PAYMENT_START_NAMES[editing.type]
  )
  const [details, setDetails] = useState(editing.method?.details ?? "")
  return (
    <form
      id={METHOD_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return onError("name")
        if (!details.trim()) return onError("details")
        onSave({ name, details })
      }}
    >
      <FieldGroup>
        <Field data-invalid={error === "name" || undefined}>
          <FieldLabel htmlFor="payment-name">{c("name")}</FieldLabel>
          <Input
            {...noAutofill("payment_name")}
            id="payment-name"
            className="min-h-11 md:min-h-9"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              onError(null)
            }}
            maxLength={PAYMENT_RULES.maxName}
            placeholder={t(`namePlaceholder.${editing.type}`)}
            aria-invalid={error === "name" || undefined}
          />
          {error === "name" && <FieldError>{c("addName")}</FieldError>}
        </Field>
        <Field data-invalid={error === "details" || undefined}>
          <FieldLabel htmlFor="payment-details">{t("details")}</FieldLabel>
          <Textarea
            id="payment-details"
            value={details}
            onChange={(event) => {
              setDetails(event.target.value)
              onError(null)
            }}
            maxLength={PAYMENT_RULES.maxDetails}
            placeholder={t(`detailsPlaceholder.${editing.type}`)}
            aria-invalid={error === "details" || undefined}
          />
          {error === "details" ? (
            <FieldError>{t("addDetails")}</FieldError>
          ) : (
            <FieldDescription>{t("detailsHint")}</FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </form>
  )
}
