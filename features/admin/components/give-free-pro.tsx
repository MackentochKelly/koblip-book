"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { AppSelect } from "@/components/app-select"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { SparklesIcon } from "@/components/ui/icons"
import { Spinner } from "@/components/ui/spinner"
import { giveFreePro } from "../api/subscription-actions"
import type { FreeBusiness } from "../api/subscriptions"

// Subscriptions' one action (P7b): pick a business on Free and give it Pro
// at no cost (a Stripe subscription with the 100% coupon).
export function GiveFreePro({ businesses }: { businesses: FreeBusiness[] }) {
  const t = useTranslations("admin.subscriptions.give")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const give = () => {
    if (!picked) return
    startTransition(async () => {
      const done = await giveFreePro(picked).catch(() => null)
      if (done?.ok) {
        setOpen(false)
        setPicked(null)
        toast.success(t("given"))
        router.refresh()
      } else {
        toast.error(t(done?.error === "has_plan" ? "hasPlan" : "failed"))
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={businesses.length === 0}>
        <SparklesIcon data-icon="inline-start" />
        {t("open")}
      </Button>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        footer={
          <Button size="lg" disabled={!picked || pending} onClick={give}>
            {pending && <Spinner data-icon="inline-start" />}
            {t("give")}
          </Button>
        }
      >
        <Field>
          <FieldLabel htmlFor="free-pro-business">{t("business")}</FieldLabel>
          <AppSelect
            id="free-pro-business"
            className="w-full"
            placeholder={t("pick")}
            options={businesses.map((business) => ({
              value: business.id,
              label: business.name,
              description: business.ownerName,
            }))}
            value={picked}
            onValueChange={setPicked}
          />
          <FieldDescription>{t("hint")}</FieldDescription>
        </Field>
      </ResponsivePanel>
    </>
  )
}
