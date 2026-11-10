"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { CopyField } from "@/components/copy-field"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { PlusIcon } from "@/components/ui/icons"
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
import { PARTNER_RULES } from "@/lib/partner-rules"
import {
  addPartnerApp,
  revokePartnerApp,
  updatePartnerApp,
} from "../api/partner-actions"
import type { AdminPartnerApp } from "../api/partners"

type Draft = { name: string; webhookUrl: string; dailyInvites: string }

const blank: Draft = {
  name: "",
  webhookUrl: "",
  dailyInvites: String(PARTNER_RULES.defaultDailyInvites),
}

// Partners' apps (docs/plans/sales-connection.md, SC2, SC10): the one
// action adds an app and shows its key and event secret once; each app
// opens to change its webhook and daily cap, or to revoke it.
export function AddPartnerApp() {
  const t = useTranslations("admin.partners.apps")
  const [open, setOpen] = useState(false)
  const [made, setMade] = useState<{ key: string; eventSecret: string } | null>(
    null
  )
  const close = () => {
    setOpen(false)
    setMade(null)
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {t("add")}
      </Button>
      {made ? (
        <ResponsivePanel
          open={open}
          onClose={close}
          title={t("madeTitle")}
          description={t("madeHint")}
          footer={
            <Button size="lg" onClick={close}>
              {t("done")}
            </Button>
          }
        >
          <FieldGroup>
            <Secret id="partner-key" label={t("key")} value={made.key} />
            <Secret
              id="partner-secret"
              label={t("eventSecret")}
              value={made.eventSecret}
            />
          </FieldGroup>
        </ResponsivePanel>
      ) : (
        <AppForm
          open={open}
          onClose={close}
          title={t("addTitle")}
          submit={t("addSubmit")}
          initial={blank}
          save={async (input) => {
            const done = await addPartnerApp(input)
            if (done.ok) setMade(done)
            return done.ok
          }}
        />
      )}
    </>
  )
}

export function PartnerApps({ apps }: { apps: AdminPartnerApp[] }) {
  const t = useTranslations("admin.partners.apps")
  const format = useFormatter()
  const [editing, setEditing] = useState<AdminPartnerApp | null>(null)
  return (
    <>
      <ItemGroup className="gap-3">
        {apps.map((app) => (
          <Item key={app.id} variant="outline">
            <ItemContent>
              <ItemTitle>
                {app.name}
                {app.revokedAt && (
                  <Badge variant="secondary">{t("revoked")}</Badge>
                )}
              </ItemTitle>
              <ItemDescription>
                {t("summary", {
                  hint: app.keyHint,
                  invites: app.invites,
                  claimed: app.claimed,
                  cap: app.dailyInvites,
                })}
              </ItemDescription>
              <ItemDescription>
                {app.webhookUrl ?? t("noWebhook")}
                {" · "}
                {format.dateTime(new Date(app.createdAt), {
                  dateStyle: "medium",
                })}
              </ItemDescription>
            </ItemContent>
            {!app.revokedAt && (
              <ItemActions>
                <Button variant="outline" onClick={() => setEditing(app)}>
                  {t("edit")}
                </Button>
              </ItemActions>
            )}
          </Item>
        ))}
      </ItemGroup>
      {editing && (
        <EditApp app={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function EditApp({
  app,
  onClose,
}: {
  app: AdminPartnerApp
  onClose: () => void
}) {
  const t = useTranslations("admin.partners.apps")
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [, startTransition] = useTransition()
  const revoke = () => {
    startTransition(async () => {
      const done = await revokePartnerApp(app.id).catch(() => null)
      if (done?.ok) {
        toast.success(t("revokedDone"))
        onClose()
        router.refresh()
      } else {
        toast.error(t("failed"))
      }
    })
  }
  return (
    <>
      <AppForm
        open={!asking}
        onClose={onClose}
        title={app.name}
        submit={t("save")}
        initial={{
          name: app.name,
          webhookUrl: app.webhookUrl ?? "",
          dailyInvites: String(app.dailyInvites),
        }}
        save={async (input) => {
          const done = await updatePartnerApp(app.id, input)
          if (done.ok) {
            toast.success(t("saved"))
            onClose()
          }
          return done.ok
        }}
        extra={
          <Button variant="outline" size="lg" onClick={() => setAsking(true)}>
            {t("revoke")}
          </Button>
        }
      />
      <ConfirmDialog
        open={asking}
        title={t("revokeTitle", { name: app.name })}
        description={t("revokeHint")}
        confirm={t("revoke")}
        cancel={t("cancel")}
        onConfirm={revoke}
        onClose={() => setAsking(false)}
      />
    </>
  )
}

function AppForm({
  open,
  onClose,
  title,
  submit,
  initial,
  save,
  extra,
}: {
  open: boolean
  onClose: () => void
  title: string
  submit: string
  initial: Draft
  save: (input: {
    name: string
    webhookUrl: string
    dailyInvites: number
  }) => Promise<boolean>
  extra?: React.ReactNode
}) {
  const t = useTranslations("admin.partners.apps")
  const router = useRouter()
  const [draft, setDraft] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  const [pending, startTransition] = useTransition()
  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ ...draft, [key]: event.target.value })
    setInvalid(false)
  }
  const send = () => {
    const dailyInvites = Number(draft.dailyInvites)
    startTransition(async () => {
      const ok = await save({
        name: draft.name,
        webhookUrl: draft.webhookUrl,
        dailyInvites,
      }).catch(() => false)
      if (ok) {
        router.refresh()
      } else {
        setInvalid(true)
      }
    })
  }
  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          {extra}
          <Button
            size="lg"
            disabled={pending || !draft.name.trim()}
            onClick={send}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {submit}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="partner-name">{t("name")}</FieldLabel>
          <Input
            id="partner-name"
            value={draft.name}
            maxLength={PARTNER_RULES.maxName}
            onChange={set("name")}
          />
        </Field>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="partner-webhook">{t("webhook")}</FieldLabel>
          <Input
            id="partner-webhook"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={draft.webhookUrl}
            maxLength={PARTNER_RULES.maxUrl}
            aria-invalid={invalid || undefined}
            onChange={set("webhookUrl")}
          />
          <FieldDescription>{t("webhookHint")}</FieldDescription>
        </Field>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="partner-cap">{t("cap")}</FieldLabel>
          <Input
            id="partner-cap"
            inputMode="numeric"
            value={draft.dailyInvites}
            aria-invalid={invalid || undefined}
            onChange={set("dailyInvites")}
          />
          {invalid && (
            <FieldError>
              {t("invalid", { max: PARTNER_RULES.maxDailyInvites })}
            </FieldError>
          )}
        </Field>
      </FieldGroup>
    </ResponsivePanel>
  )
}

function Secret({
  id,
  label,
  value,
}: {
  id: string
  label: string
  value: string
}) {
  const t = useTranslations("admin.partners.apps")
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <CopyField
        id={id}
        value={value}
        copyLabel={t("copy")}
        copiedLabel={t("copied")}
        failedLabel={t("failed")}
      />
    </Field>
  )
}
