"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { CurrencyPicker } from "@/components/currency-picker"
import { FormActions } from "@/components/form-actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/phone-input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { SparklesIcon } from "@/components/ui/icons"
import { updateBusinessDetails } from "../api/actions"
import { improveDetails } from "../api/improve-details"
import type { BusinessDetailsInput } from "../types"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"

type Invalid = "name" | "phone" | "website" | "seats" | null

// The business's name, address, About, phone and website, and how many people can be booked at
// the same time when there is no team. In Settings, and right after sign-up
// (with `next`: the button says Continue and goes there). With Meta AI on,
// Muse can tidy the name and rewrite the About in the form; nothing is
// saved until the button is pressed.
export function DetailsForm({
  businessId,
  details,
  hasTeam,
  title,
  next,
  canImprove = false,
}: {
  businessId: string
  details: BusinessDetailsInput
  hasTeam: boolean
  // null: no heading (Settings gives it the section title every part has).
  title?: string | null
  next?: string
  canImprove?: boolean
}) {
  const m = useOwnerMessages()
  const t = m.settings.details
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [improving, startImproving] = useTransition()
  const [name, setName] = useState(details.name)
  const [address, setAddress] = useState(details.address ?? "")
  const [description, setDescription] = useState(details.description ?? "")
  const [phone, setPhone] = useState(details.phone ?? "")
  const [website, setWebsite] = useState(details.website ?? "")
  const [seats, setSeats] = useState(String(details.seats))
  const [currency, setCurrency] = useState(details.currency)
  const [invalid, setInvalid] = useState<Invalid>(null)
  const changed =
    name !== details.name ||
    address !== (details.address ?? "") ||
    description !== (details.description ?? "") ||
    phone !== (details.phone ?? "") ||
    website !== (details.website ?? "") ||
    seats !== String(details.seats) ||
    currency !== details.currency

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const seatsValue = Number(seats)
    if (!name.trim()) return setInvalid("name")
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim()))
      return setInvalid("phone")
    if (website.trim() && !/^https?:\/\/\S+\.\S+/.test(website.trim())) {
      return setInvalid("website")
    }
    if (
      !Number.isInteger(seatsValue) ||
      seatsValue < 1 ||
      seatsValue > BOOKING_RULES.maxSeats
    ) {
      return setInvalid("seats")
    }
    setInvalid(null)
    startTransition(async () => {
      const result = await updateBusinessDetails(businessId, {
        name: name.trim(),
        address: address.trim() || null,
        description: description.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        seats: seatsValue,
        currency,
      }).catch(() => null)
      if (result?.ok && next) {
        router.push(next)
      } else if (result?.ok) {
        toast.success(m.settings.saved)
        router.refresh()
      } else {
        // No answer at all (offline, server down) is not the fields' fault.
        toast.error(result ? t.saveFailed : m.settings.tryAgain)
      }
    })
  }

  const improve = () => {
    if (!name.trim()) return setInvalid("name")
    startImproving(async () => {
      const before = { name, description }
      const result = await improveDetails(businessId, {
        name: name.trim(),
        description: description.trim() || null,
      }).catch(() => null)
      if (!result?.ok) {
        toast.error(t.improveFailed)
        return
      }
      setName(result.name)
      setDescription(result.description)
      toast.success(t.improved, {
        action: {
          label: t.undo,
          onClick: () => {
            setName(before.name)
            setDescription(before.description)
          },
        },
      })
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {title !== null && (
        // In the dashboard the top bar names Settings on a phone; setup has
        // no such bar, so its own title always shows.
        <h1
          className={
            title === undefined
              ? "text-2xl font-semibold tracking-tight max-md:sr-only"
              : "text-2xl font-semibold tracking-tight"
          }
        >
          {title ?? m.shell.nav.settings}
        </h1>
      )}
      {canImprove && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={improve}
          disabled={improving || pending}
        >
          {improving ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SparklesIcon data-icon="inline-start" />
          )}
          {t.improve}
        </Button>
      )}
      <FieldGroup>
        <Field data-invalid={invalid === "name" || undefined}>
          <FieldLabel htmlFor="details-name">{t.name}</FieldLabel>
          <Input
            {...noAutofill("details_name")}
            id="details-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxBusinessName}
            aria-invalid={invalid === "name" || undefined}
          />
          {invalid === "name" && <FieldError>{t.addName}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="details-about">{t.about}</FieldLabel>
          <Textarea
            {...noAutofill("details_about")}
            id="details-about"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={BOOKING_RULES.maxBusinessDescription}
            className="min-h-32"
          />
        </Field>
        <Field data-invalid={invalid === "phone" || undefined}>
          <FieldLabel htmlFor="details-phone">{t.phone}</FieldLabel>
          <PhoneInput
            {...noAutofill("details_phone")}
            id="details-phone"
            value={phone}
            onChange={setPhone}
            aria-invalid={invalid === "phone" || undefined}
            locale={m.locale}
          />
          {invalid === "phone" && <FieldError>{t.checkPhone}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="details-address">{t.address}</FieldLabel>
          <Input
            {...noAutofill("details_address")}
            id="details-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={BOOKING_RULES.maxBusinessAddress}
          />
        </Field>
        <Field data-invalid={invalid === "website" || undefined}>
          <FieldLabel htmlFor="details-website">{t.website}</FieldLabel>
          <Input
            {...noAutofill("details_website")}
            id="details-website"
            type="url"
            inputMode="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://"
            aria-invalid={invalid === "website" || undefined}
          />
          {invalid === "website" && <FieldError>{t.fullLink}</FieldError>}
        </Field>
        {/* Settings only: right after sign-up it would just confuse. */}
        {!hasTeam && !next && (
          <Field data-invalid={invalid === "seats" || undefined}>
            <FieldLabel htmlFor="details-seats">{t.seats}</FieldLabel>
            <Input
              id="details-seats"
              type="number"
              inputMode="numeric"
              min={1}
              max={BOOKING_RULES.maxSeats}
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              className="w-24"
              aria-invalid={invalid === "seats" || undefined}
            />
            <FieldDescription>{t.seatsHint}</FieldDescription>
            {invalid === "seats" && (
              <FieldError>{t.seatsRange(BOOKING_RULES.maxSeats)}</FieldError>
            )}
          </Field>
        )}
        {/* Settings only; sign-up keeps the currency from the country. */}
        {currency !== undefined && !next && (
          <Field>
            <FieldLabel htmlFor="details-currency">{t.currency}</FieldLabel>
            <CurrencyPicker
              id="details-currency"
              value={currency}
              onChange={setCurrency}
              locale={m.locale}
              empty={t.noCurrency}
            />
            <FieldDescription>{t.currencyHint}</FieldDescription>
          </Field>
        )}
      </FieldGroup>
      {/* The big button at the end of the form, like the login card's. In
          Settings it is Save and waits for a change; right after sign-up it
          is Continue and moves on. */}
      <FormActions>
        <Button type="submit" size="lg" disabled={pending || (!next && !changed)}>
          {pending && <Spinner data-icon="inline-start" />}
          {next ? m.settings.continue : m.settings.save}
        </Button>
      </FormActions>
    </form>
  )
}
