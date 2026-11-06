"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { PageSection } from "@/components/page-section"
import { PolicyPointIcon } from "@/components/policy-point-icon"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { InfoIcon, PlusIcon, Trash2Icon } from "@/components/ui/icons"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { noAutofill } from "@/lib/no-autofill"
import {
  POLICY_POINT_ICONS,
  POLICY_RULES,
  type PolicyPointIcon as PolicyPointIconName,
} from "@/lib/policy-rules"
import { TOUCH_AREA } from "@/lib/touch-area"
import { removePolicyPoint, savePolicyPoint } from "../api/policy-actions"
import type { OwnerPolicyPoint } from "../types"
import { ConfirmRemove } from "./confirm-remove"

const POINT_FORM = "policy-point-form"

type Invalid = "title" | "body" | null

// The key points customers agree to in the booking flow's last step, as
// cards with a picture. Muse writes the first ones at setup; the owner
// adds, edits or removes them, up to POLICY_RULES.maxPoints.
export function PolicyPointsSection({
  businessId,
  points,
}: {
  businessId: string
  points: OwnerPolicyPoint[]
}) {
  const settings = useTranslations("owner.settings")
  const t = useTranslations("owner.settings.policies.points")
  const c = useTranslations("owner.catalog.common")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The point being edited, "new" while adding, null when closed.
  const [editing, setEditing] = useState<OwnerPolicyPoint | "new" | null>(null)
  const [icon, setIcon] = useState<PolicyPointIconName>("info")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [invalid, setInvalid] = useState<Invalid>(null)
  const [removing, setRemoving] = useState<OwnerPolicyPoint | null>(null)
  const full = points.length >= POLICY_RULES.maxPoints

  const open = (point: OwnerPolicyPoint | "new") => {
    setIcon(point === "new" ? "info" : point.icon)
    setTitle(point === "new" ? "" : point.title)
    setBody(point === "new" ? "" : point.body)
    setInvalid(null)
    setEditing(point)
  }
  const changed =
    editing === "new" ||
    (editing !== null &&
      (icon !== editing.icon ||
        title.trim() !== editing.title ||
        body.trim() !== editing.body))

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editing === null) return
    if (!title.trim()) return setInvalid("title")
    if (!body.trim()) return setInvalid("body")
    setInvalid(null)
    startTransition(async () => {
      const result = await savePolicyPoint(
        businessId,
        editing === "new" ? null : editing.id,
        { icon, title, body }
      ).catch(() => null)
      if (result?.ok) {
        setEditing(null)
        toast.success(settings("saved"))
        router.refresh()
      } else {
        toast.error(
          result?.error === "limit"
            ? t("limit", { max: POLICY_RULES.maxPoints })
            : settings("policies.saveFailed")
        )
      }
    })
  }

  const remove = (point: OwnerPolicyPoint) =>
    startTransition(async () => {
      const result = await removePolicyPoint(businessId, point.id).catch(
        () => null
      )
      if (result?.ok) {
        toast.success(t("removed"))
        router.refresh()
      } else {
        toast.error(c("failed"))
      }
    })

  return (
    <PageSection
      id="policy-points"
      title={t("title")}
      action={
        <Button
          variant="outline"
          onClick={() => open("new")}
          disabled={full}
          title={full ? t("limit", { max: POLICY_RULES.maxPoints }) : undefined}
        >
          <PlusIcon data-icon="inline-start" />
          {t("add")}
        </Button>
      }
    >
      <p className="-mt-2 text-sm text-muted-foreground">{t("hint")}</p>
      {points.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InfoIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {points.map((point) => (
            <Item key={point.id} variant="outline">
              <ItemMedia variant="icon">
                <PolicyPointIcon icon={point.icon} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{point.title}</ItemTitle>
                <ItemDescription>{point.body}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" onClick={() => open(point)}>
                  {c("edit")}
                </Button>
                <DropdownMenu>
                  <MoreMenuTrigger label={c("more")} />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={pending}
                      onClick={() => setRemoving(point)}
                    >
                      <Trash2Icon />
                      {c("remove")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      <ConfirmRemove
        name={removing ? removing.title : null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("addPoint") : t("editPoint")}
        footer={
          <Button
            type="submit"
            size="lg"
            form={POINT_FORM}
            disabled={pending || !changed}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {settings("save")}
          </Button>
        }
      >
        {editing !== null && (
          <form id={POINT_FORM} onSubmit={submit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel id="policy-point-picture">{t("picture")}</FieldLabel>
                <ToggleGroup
                  variant="outline"
                  aria-labelledby="policy-point-picture"
                  className="flex-wrap"
                  value={[icon]}
                  onValueChange={(next) => {
                    const picked = POLICY_POINT_ICONS.find(
                      (item) => item === next[0]
                    )
                    if (picked) setIcon(picked)
                  }}
                >
                  {POLICY_POINT_ICONS.map((item) => (
                    <ToggleGroupItem
                      key={item}
                      value={item}
                      aria-label={t(`pictures.${item}`)}
                      title={t(`pictures.${item}`)}
                      className={TOUCH_AREA}
                    >
                      <PolicyPointIcon icon={item} />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <Field data-invalid={invalid === "title" || undefined}>
                <FieldLabel htmlFor="policy-point-title">
                  {t("pointTitle")}
                </FieldLabel>
                <Input
                  {...noAutofill("policy_point_title")}
                  id="policy-point-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={POLICY_RULES.maxPointTitle}
                  aria-invalid={invalid === "title" || undefined}
                />
                {invalid === "title" && <FieldError>{t("addTitle")}</FieldError>}
              </Field>
              <Field data-invalid={invalid === "body" || undefined}>
                <FieldLabel htmlFor="policy-point-text">{t("pointText")}</FieldLabel>
                <Textarea
                  {...noAutofill("policy_point_text")}
                  id="policy-point-text"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={POLICY_RULES.maxPointBody}
                  className="min-h-28"
                  aria-invalid={invalid === "body" || undefined}
                />
                {invalid === "body" ? (
                  <FieldError>{t("addText")}</FieldError>
                ) : (
                  <FieldDescription>
                    {body.length}/{POLICY_RULES.maxPointBody}
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
