"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { BanknoteIcon, ChevronRightIcon } from "@/components/ui/icons"
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
import type { WhatsappUsage as Usage, UsageBusiness } from "../api/whatsapp-usage"
import { saveKoblipLimit } from "../api/whatsapp-usage-actions"
import { useAdminMessages } from "../i18n/provider"

const FORM = "koblip-limit-form"

// What the panel edits: everyone's limit, or one business's own.
type Editing = { business: UsageBusiness | null }

// WhatsApp → Usage (A8): Koblip's monthly limit for everyone, then each
// business's templates from Koblip's number this month against its limit.
// Tapping either opens it to change; the server checks and logs each change.
export function WhatsappUsage({ usage }: { usage: Usage }) {
  const m = useAdminMessages()
  const t = m.whatsapp.usage
  const [editing, setEditing] = useState<Editing | null>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [invalid, setInvalid] = useState(false)
  const [pending, startTransition] = useTransition()
  const month = new Intl.DateTimeFormat(m.locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(usage.month))

  function edit(business: UsageBusiness | null) {
    setEditing({ business })
    setInput(String(business ? business.limit : usage.limit))
    setInvalid(false)
    setOpen(true)
  }

  function save(value: number | null) {
    if (!editing) return
    startTransition(async () => {
      const done = await saveKoblipLimit(editing.business?.id ?? null, value).catch(() => null)
      if (done?.ok) {
        setOpen(false)
        toast.success(t.saved)
      } else if (done?.error === "invalid") {
        setInvalid(true)
      } else {
        toast.error(t.failed)
      }
    })
  }

  // The value set here, if any: a business's own, or the admin's for everyone.
  const own = editing
    ? editing.business
      ? editing.business.ownLimit
      : usage.changed
        ? usage.limit
        : null
    : null

  return (
    <div className="flex flex-col gap-6">
      <ItemGroup className="gap-3">
        <Item variant="outline" render={<button type="button" onClick={() => edit(null)} />}>
          <ItemContent className="min-w-0">
            <ItemTitle>{t.everyone}</ItemTitle>
            <ItemDescription className="break-words">
              {usage.changed
                ? `${t.perMonth(usage.limit)} · ${t.byDefault(usage.defaultLimit)}`
                : t.perMonth(usage.limit)}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {usage.changed && <Badge variant="secondary">{t.changed}</Badge>}
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </ItemActions>
        </Item>
      </ItemGroup>

      <section className="flex flex-col gap-3" aria-labelledby="usage-month">
        <h2 id="usage-month" className="text-lg font-semibold tracking-tight">
          {t.month(month)}
        </h2>
        {usage.businesses.length ? (
          <ItemGroup className="gap-3">
            {usage.businesses.map((business) => (
              <Item
                key={business.id}
                variant="outline"
                render={<button type="button" onClick={() => edit(business)} />}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="max-w-full">
                    <span className="truncate">{business.name}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {business.ownLimit === null
                      ? t.sent(business.sent, business.limit)
                      : `${t.sent(business.sent, business.limit)} · ${t.ownLimit}`}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {business.sent >= business.limit && (
                    <Badge variant="destructive">{t.atLimit}</Badge>
                  )}
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BanknoteIcon />
              </EmptyMedia>
              <EmptyTitle>{t.none}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={editing?.business ? t.limitFor(editing.business.name) : t.everyone}
        footer={
          <>
            {own !== null && (
              <Button variant="outline" size="lg" disabled={pending} onClick={() => save(null)}>
                {editing?.business ? t.useEveryone : t.useDefault}
              </Button>
            )}
            <Button type="submit" size="lg" form={FORM} disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {t.save}
            </Button>
          </>
        }
      >
        <form
          id={FORM}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const value = input.trim()
            if (!/^\d+$/.test(value)) {
              setInvalid(true)
              return
            }
            save(Number(value))
          }}
        >
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="koblip-limit">{t.limit}</FieldLabel>
            <Input
              id="koblip-limit"
              inputMode="numeric"
              value={input}
              aria-invalid={invalid || undefined}
              onChange={(event) => {
                setInput(event.target.value)
                setInvalid(false)
              }}
            />
            {invalid && <FieldError>{t.invalid}</FieldError>}
          </Field>
          <FieldDescription>{t.hint}</FieldDescription>
        </form>
      </ResponsivePanel>
    </div>
  )
}
