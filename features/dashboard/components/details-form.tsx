"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_RULES, PHONE_PATTERN } from "@/lib/booking-rules"
import { updateBusinessDetails } from "../api/actions"
import type { BusinessDetailsInput } from "../types"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"

type Invalid = "name" | "phone" | "website" | "seats" | null

// The business's name, address, About, phone and website, and how many people can be booked at
// the same time when there is no team. In Settings, and right after sign-up
// (with `next`: where Save goes).
export function DetailsForm({
  businessId,
  details,
  hasTeam,
  title,
  next,
}: {
  businessId: string
  details: BusinessDetailsInput
  hasTeam: boolean
  title?: string
  next?: string
}) {
  const m = useOwnerMessages()
  const t = m.settings.details
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(details.name)
  const [address, setAddress] = useState(details.address ?? "")
  const [description, setDescription] = useState(details.description ?? "")
  const [phone, setPhone] = useState(details.phone ?? "")
  const [website, setWebsite] = useState(details.website ?? "")
  const [seats, setSeats] = useState(String(details.seats))
  const [invalid, setInvalid] = useState<Invalid>(null)

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
      })
      if (result.ok && next) {
        router.push(next)
      } else if (result.ok) {
        toast.success(m.settings.saved)
        router.refresh()
      } else {
        toast.error(t.saveFailed)
      }
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {title ?? m.shell.nav.settings}
      </h1>
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
          <Input
            {...noAutofill("details_phone")}
            id="details-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={invalid === "phone" || undefined}
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
      </FieldGroup>
      {/* Save is the big button at the end of the form, like the login card's. */}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        {m.settings.save}
      </Button>
    </form>
  )
}
