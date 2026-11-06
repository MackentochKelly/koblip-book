"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { PageSection } from "@/components/page-section"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  BadgeCheckIcon,
  BookmarkIcon,
  CalendarIcon,
  ExternalLinkIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
  type Icon,
} from "@/components/ui/icons"
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
import { Textarea } from "@/components/ui/textarea"
import { noAutofill } from "@/lib/no-autofill"
import {
  POLICY_KINDS,
  POLICY_RULES,
  policySegment,
  type PolicyKind,
} from "@/lib/policy-rules"
import { removePolicy, saveOwnPolicy, savePolicy } from "../api/policy-actions"
import type { OwnerPolicy } from "../types"
import { ConfirmRemove } from "./confirm-remove"

const ICONS: Record<PolicyKind, Icon> = {
  booking: CalendarIcon,
  terms: BadgeCheckIcon,
  privacy: ShieldCheckIcon,
}

const POLICY_FORM = "policy-form"

// What the panel is writing: a standard kind or the owner's own (kind null),
// a new one (policy null) or one already on the page.
type Editing = { kind: PolicyKind | null; policy: OwnerPolicy | null }

type Invalid = "title" | "body" | null

// The business's policies, as linked from its page: the booking policy,
// terms and privacy notice (Muse writes them at setup) and the owner's own,
// each with its title. The owner adds them (a standard one not on the page
// yet, or their own), edits or removes them, up to
// POLICY_RULES.maxPolicies, like the key points below.
export function PoliciesSection({
  businessId,
  slug,
  policies,
}: {
  businessId: string
  slug: string
  policies: OwnerPolicy[]
}) {
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.policies")
  const c = useTranslations("owner.catalog.common")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [invalid, setInvalid] = useState<Invalid>(null)
  const [removing, setRemoving] = useState<OwnerPolicy | null>(null)
  const full = policies.length >= POLICY_RULES.maxPolicies
  // The standard kinds the page doesn't have, offered first by Add.
  const missing = POLICY_KINDS.filter(
    (kind) => !policies.some((policy) => policy.kind === kind)
  )

  const nameOf = (policy: OwnerPolicy) =>
    policy.kind ? t(`kinds.${policy.kind}`) : (policy.title ?? "")

  const open = (next: Editing) => {
    setTitle(next.policy?.title ?? "")
    setText(next.policy?.body ?? "")
    setInvalid(null)
    setEditing(next)
  }
  const own = editing !== null && editing.kind === null
  const changed =
    editing !== null &&
    (editing.policy === null ||
      text.trim() !== editing.policy.body ||
      (own && title.trim() !== editing.policy.title))

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editing === null) return
    if (own && !title.trim()) return setInvalid("title")
    if (!text.trim()) return setInvalid("body")
    setInvalid(null)
    startTransition(async () => {
      const result = await (
        editing.kind === null
          ? saveOwnPolicy(businessId, editing.policy?.id ?? null, {
              title,
              body: text,
            })
          : savePolicy(businessId, editing.kind, text)
      ).catch(() => null)
      if (result?.ok) {
        setEditing(null)
        toast.success(settings("saved"))
        router.refresh()
      } else {
        toast.error(
          result?.error === "limit"
            ? t("limit", { max: POLICY_RULES.maxPolicies })
            : t("saveFailed")
        )
      }
    })
  }

  const remove = (policy: OwnerPolicy) =>
    startTransition(async () => {
      const result = await removePolicy(businessId, policy.id).catch(() => null)
      if (result?.ok) {
        toast.success(t("removed"))
        router.refresh()
      } else {
        toast.error(c("failed"))
      }
    })

  const addButton = (
    <>
      <PlusIcon data-icon="inline-start" />
      {c("add")}
    </>
  )
  const limitTitle = full ? t("limit", { max: POLICY_RULES.maxPolicies }) : undefined

  return (
    <PageSection
      id="policies"
      title={t("title")}
      action={
        // With every standard one on the page, Add writes the owner's own.
        missing.length === 0 ? (
          <Button
            variant="outline"
            onClick={() => open({ kind: null, policy: null })}
            disabled={full}
            title={limitTitle}
          >
            {addButton}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" disabled={full} title={limitTitle} />
              }
            >
              {addButton}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {missing.map((kind) => {
                const KindIcon = ICONS[kind]
                return (
                  <DropdownMenuItem
                    key={kind}
                    onClick={() => open({ kind, policy: null })}
                  >
                    <KindIcon />
                    {t(`kinds.${kind}`)}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => open({ kind: null, policy: null })}
              >
                <BookmarkIcon />
                {t("own")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    >
      {policies.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {policies.map((policy) => {
            const PolicyIcon = policy.kind ? ICONS[policy.kind] : BookmarkIcon
            return (
              <Item key={policy.id} variant="outline">
                <ItemMedia variant="icon">
                  <PolicyIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{nameOf(policy)}</ItemTitle>
                  <ItemDescription>{policy.body}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    onClick={() => open({ kind: policy.kind, policy })}
                  >
                    {c("edit")}
                  </Button>
                  <DropdownMenu>
                    <MoreMenuTrigger label={c("more")} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        render={
                          <a
                            href={`/b/${slug}/policies/${policySegment(policy)}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <ExternalLinkIcon />
                        {t("view")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onClick={() => setRemoving(policy)}
                      >
                        <Trash2Icon />
                        {c("remove")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      )}

      <ConfirmRemove
        name={removing ? nameOf(removing) : null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing?.policy
            ? nameOf(editing.policy)
            : editing?.kind
              ? t(`kinds.${editing.kind}`)
              : t("own")
        }
        footer={
          <Button
            type="submit"
            size="lg"
            form={POLICY_FORM}
            disabled={pending || !changed}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {settings("save")}
          </Button>
        }
      >
        {editing !== null && (
          <form id={POLICY_FORM} onSubmit={submit} noValidate>
            <FieldGroup>
              {own && (
                <Field data-invalid={invalid === "title" || undefined}>
                  <FieldLabel htmlFor="policy-title">
                    {t("policyTitle")}
                  </FieldLabel>
                  <Input
                    {...noAutofill("policy_title")}
                    id="policy-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t("titleExample")}
                    maxLength={POLICY_RULES.maxTitle}
                    aria-invalid={invalid === "title" || undefined}
                  />
                  {invalid === "title" && <FieldError>{t("addTitle")}</FieldError>}
                </Field>
              )}
              <Field data-invalid={invalid === "body" || undefined}>
                {/* A standard one is named by the panel's title. */}
                <FieldLabel
                  htmlFor="policy-text"
                  className={own ? undefined : "sr-only"}
                >
                  {own || editing.kind === null
                    ? t("policyText")
                    : t(`kinds.${editing.kind}`)}
                </FieldLabel>
                <Textarea
                  {...noAutofill("policy_text")}
                  id="policy-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={POLICY_RULES.maxLength}
                  className="min-h-64"
                  aria-invalid={invalid === "body" || undefined}
                />
                {invalid === "body" ? (
                  <FieldError>{t("addText")}</FieldError>
                ) : (
                  <FieldDescription>
                    {text.length}/{POLICY_RULES.maxLength}
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        )}
      </ResponsivePanel>
    </PageSection>
  )
}
