"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { PageSection } from "@/components/page-section"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  BadgeCheckIcon,
  CalendarIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  type Icon,
} from "@/components/ui/icons"
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
import { Textarea } from "@/components/ui/textarea"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { noAutofill } from "@/lib/no-autofill"
import { POLICY_KINDS, POLICY_RULES, type PolicyKind } from "@/lib/policy-rules"
import { savePolicy } from "../api/policy-actions"

const ICONS: Record<PolicyKind, Icon> = {
  booking: CalendarIcon,
  terms: BadgeCheckIcon,
  privacy: ShieldCheckIcon,
}

const POLICY_FORM = "policy-form"

// The business's booking policy, terms and privacy notice, as shown on its
// page. Muse writes them at setup; each opens in a panel to edit.
export function PoliciesSection({
  businessId,
  slug,
  policies,
}: {
  businessId: string
  slug: string
  policies: Record<PolicyKind, string>
}) {
  const m = useOwnerMessages()
  const t = m.settings.policies
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<PolicyKind | null>(null)
  const [text, setText] = useState("")

  const open = (kind: PolicyKind) => {
    setText(policies[kind])
    setEditing(kind)
  }
  const changed = editing !== null && text.trim() !== policies[editing]

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editing === null) return
    startTransition(async () => {
      const result = await savePolicy(businessId, editing, text).catch(
        () => null
      )
      if (result?.ok) {
        setEditing(null)
        toast.success(m.settings.saved)
        router.refresh()
      } else {
        toast.error(t.saveFailed)
      }
    })
  }

  return (
    <PageSection id="policies" title={t.title}>
      <ItemGroup className="gap-3">
        {POLICY_KINDS.map((kind) => {
          const PolicyIcon = ICONS[kind]
          const shown = policies[kind] !== ""
          return (
            <Item key={kind} variant="outline">
              <ItemMedia variant="icon">
                <PolicyIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t.kinds[kind]}</ItemTitle>
                <ItemDescription>{shown ? t.shown : t.hidden}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" onClick={() => open(kind)}>
                  {m.catalog.common.edit}
                </Button>
                {shown && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t.view}
                    title={t.view}
                    nativeButton={false}
                    render={
                      <a
                        href={`/b/${slug}/policies/${kind}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <ExternalLinkIcon />
                  </Button>
                )}
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? t.kinds[editing] : t.title}
        footer={
          <Button
            type="submit"
            size="lg"
            form={POLICY_FORM}
            disabled={pending || !changed}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {m.settings.save}
          </Button>
        }
      >
        {editing !== null && (
          <form id={POLICY_FORM} onSubmit={submit} noValidate>
            <Field>
              <FieldLabel htmlFor="policy-text" className="sr-only">
                {t.kinds[editing]}
              </FieldLabel>
              <Textarea
                {...noAutofill("policy_text")}
                id="policy-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={POLICY_RULES.maxLength}
                className="min-h-64"
              />
              <FieldDescription>{t.emptyHint}</FieldDescription>
            </Field>
          </form>
        )}
      </ResponsivePanel>
    </PageSection>
  )
}
