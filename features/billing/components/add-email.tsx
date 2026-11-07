"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

// An account made by phone has no real email, and Stripe needs one for
// receipts and reminders (lib/auth.ts). Better Auth's change email sends a
// link to the new address; opening it saves the address and comes back to
// `returnTo`.
export function AddEmail({ returnTo }: { returnTo: string }) {
  const t = useTranslations("billing.addEmail")
  const settings = useTranslations("owner.settings")
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()

  const send = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await authClient
        .changeEmail({ newEmail: email.trim(), callbackURL: returnTo })
        .catch((error: unknown) => ({ error }))
      if (result.error) {
        toast.error(settings("tryAgain"))
        return
      }
      setOpen(false)
      setEmail("")
      toast.success(t("sent"))
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("open")}</Button>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        footer={
          <Button size="lg" type="submit" form="add-email" disabled={!email.trim() || pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t("send")}
          </Button>
        }
      >
        <form id="add-email" onSubmit={send}>
          <Field>
            <FieldLabel htmlFor="add-email-address">{t("email")}</FieldLabel>
            <Input
              id="add-email-address"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
            />
          </Field>
        </form>
      </ResponsivePanel>
    </>
  )
}
