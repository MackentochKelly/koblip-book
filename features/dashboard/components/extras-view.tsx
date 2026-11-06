"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { useShowFirst } from "@/hooks/use-show-first"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { AppSelect } from "@/components/app-select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { useFormatDuration } from "@/hooks/use-format-duration"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { parsePrice } from "@/lib/parse-price"
import {
  createAddonGroup,
  deleteAddonGroup,
  reorderAddonGroups,
  updateAddonGroup,
} from "../api/addon-actions"
import type {
  AddonGroupInput,
  OwnerAddonGroup,
  OwnerServiceCategory,
} from "../types"
import { CATALOG_FIRST_SHOWN } from "../utils/catalog-list"
import { serviceSelectOptions } from "../utils/service-options"
import { noAutofill } from "@/lib/no-autofill"
import { ConfirmRemove } from "./confirm-remove"
import { ListFooter, ShowMore } from "./list-footer"

const FORM = "extras-form"

// How many a customer picks from a group, as four plain choices.
const CHOICES = [
  { value: "any", label: "any", min: 0, max: null },
  { value: "one", label: "one", min: 0, max: 1 },
  { value: "must-one", label: "mustOne", min: 1, max: 1 },
  { value: "must-any", label: "mustAny", min: 1, max: null },
] as const

function choiceOf(group: { minSelect: number; maxSelect: number | null }) {
  return (
    CHOICES.find(
      (choice) =>
        choice.min === Math.min(group.minSelect, 1) &&
        choice.max === (group.maxSelect === 1 ? 1 : null)
    ) ?? CHOICES[0]
  )
}

// A service an extra can be offered with.
interface ExtrasService {
  id: string
  name: string
  // Null: Other.
  categoryId: string | null
}

// Extras a customer can add to a service (Fresha's add-ons): a group with
// a question, its options, and the services it is offered with.
export function ExtrasView({
  businessId,
  groups,
  services,
  categories,
  adding,
  onAddClosed,
  phoneSuggest,
}: {
  businessId: string
  groups: OwnerAddonGroup[]
  services: ExtrasService[]
  // In their order: Offered with's groups.
  categories: OwnerServiceCategory[]
  // The page's Add button opens a new group here.
  adding: boolean
  onAddClosed: () => void
  // The phone's Suggest button, under the list with Show more.
  phoneSuggest?: React.ReactNode
}) {
  const router = useRouter()
  const c = useTranslations("owner.catalog.common")
  const t = useTranslations("owner.catalog.extras")
  const [editing, setEditing] = useState<OwnerAddonGroup | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [removing, setRemoving] = useState<OwnerAddonGroup | null>(null)
  const [pending, startTransition] = useTransition()
  // Whether the open form differs from the saved group.
  const [changed, setChanged] = useState(false)
  const panelOpen = adding || editing !== null
  const names = new Map(services.map((service) => [service.id, service.name]))

  const closePanel = () => {
    setEditing(null)
    onAddClosed()
  }
  const run = (task: () => Promise<{ ok: boolean }>, done?: string) =>
    startTransition(async () => {
      const result = await task().catch(() => ({ ok: false }))
      if (result.ok) {
        if (done) toast.success(done)
        router.refresh()
      } else {
        toast.error(c("failed"))
      }
    })
  const move = (index: number, by: number) => {
    const ids = groups.map((group) => group.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    run(() => reorderAddonGroups(businessId, ids))
  }
  const first = useShowFirst(groups, CATALOG_FIRST_SHOWN)

  return (
    <>
      {groups.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {first.shown.map((group, index) => (
            <Item key={group.id} variant="outline">
              <ItemContent>
                <ItemTitle>{group.name}</ItemTitle>
                <ItemDescription>
                  {group.options.map((option) => option.name).join(", ")}
                  {group.serviceIds.length > 0 &&
                    ` · ${group.serviceIds
                      .map((id) => names.get(id))
                      .filter(Boolean)
                      .join(", ")}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormKey((value) => value + 1)
                    setEditing(group)
                  }}
                >
                  {c("edit")}
                </Button>
                <DropdownMenu>
                  <MoreMenuTrigger label={c("more")} />
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={index === 0 || pending}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUpIcon />
                        {c("moveUp")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === groups.length - 1 || pending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon />
                        {c("moveDown")}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onClick={() => setRemoving(group)}
                      >
                        <Trash2Icon />
                        {c("remove")}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
      <ListFooter
        showMore={first.hidden > 0 && <ShowMore label={c("showMore", { count: first.hidden })} onClick={first.showAll} />}
        suggest={phoneSuggest}
      />

      <ConfirmRemove
        name={removing?.name ?? null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          run(() => deleteAddonGroup(businessId, removing.id), t("removed"))
        }
      />

      <ResponsivePanel
        open={panelOpen}
        onClose={closePanel}
        title={editing ? t("edit") : t("add")}
        footer={
          <Button
            type="submit"
            size="lg"
            form={FORM}
            disabled={pending || (editing !== null && !changed)}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {c("save")}
          </Button>
        }
      >
        {panelOpen && (
          <ExtrasForm
            key={`${formKey}-${editing?.id ?? "new"}-${adding}`}
            group={editing}
            services={services}
            categories={categories}
            onChanged={setChanged}
            onSave={(input) =>
              startTransition(async () => {
                const result = await (
                  editing
                    ? updateAddonGroup(businessId, editing.id, input)
                    : createAddonGroup(businessId, input)
                ).catch(() => ({ ok: false }))
                if (result.ok) {
                  closePanel()
                  toast.success(c("saved"))
                  router.refresh()
                } else {
                  toast.error(c("checkFields"))
                }
              })
            }
          />
        )}
      </ResponsivePanel>
    </>
  )
}

interface OptionDraft {
  key: number
  id: string | null
  name: string
  description: string
  price: string
  minutes: string
}

type Invalid = "name" | "prompt" | "options" | null

function ExtrasForm({
  group,
  services,
  categories,
  onChanged,
  onSave,
}: {
  group: OwnerAddonGroup | null
  services: ExtrasService[]
  categories: OwnerServiceCategory[]
  onChanged: (changed: boolean) => void
  onSave: (input: AddonGroupInput) => void
}) {
  const c = useTranslations("owner.catalog.common")
  const t = useTranslations("owner.catalog.extras")
  const words = useTranslations("owner.catalog.categories")
  const formatDuration = useFormatDuration()
  const minutesItems = BOOKING_RULES.addonMinutes.map((minutes) => ({
    value: String(minutes),
    label: minutes === 0 ? t("noExtraTime") : `+${formatDuration(minutes)}`,
  }))
  const [name, setName] = useState(group?.name ?? "")
  const [prompt, setPrompt] = useState(group?.prompt ?? "")
  const [choice, setChoice] = useState<string>(
    group ? choiceOf(group).value : CHOICES[0].value
  )
  const [serviceIds, setServiceIds] = useState(group?.serviceIds ?? [])
  const [nextKey, setNextKey] = useState(group?.options.length ?? 1)
  const [options, setOptions] = useState<OptionDraft[]>(
    group
      ? group.options.map((option, index) => ({
          key: index,
          id: option.id,
          name: option.name,
          description: option.description ?? "",
          price:
            option.priceMinor !== null ? String(option.priceMinor / 100) : "",
          minutes: String(option.durationMinutes),
        }))
      : [
          {
            key: 0,
            id: null,
            name: "",
            description: "",
            price: "",
            minutes: "0",
          },
        ]
  )
  const [invalid, setInvalid] = useState<Invalid>(null)
  const [badOption, setBadOption] = useState<number | null>(null)
  // Everything the owner can change, to compare with how the form opened.
  const snapshot = JSON.stringify({
    name,
    prompt,
    choice,
    serviceIds: [...serviceIds].sort(),
    options: options.map((option) => [
      option.id,
      option.name,
      option.description,
      option.price,
      option.minutes,
    ]),
  })
  const [opened] = useState(snapshot)
  const changed = snapshot !== opened
  useEffect(() => onChanged(changed), [changed, onChanged])

  const update = (key: number, change: Partial<OptionDraft>) =>
    setOptions((current) =>
      current.map((option) =>
        option.key === key ? { ...option, ...change } : option
      )
    )
  const choices = CHOICES.map(({ value, label }) => ({
    value,
    label: t(`choices.${label}`),
  }))

  return (
    <form
      id={FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return setInvalid("name")
        if (!prompt.trim()) return setInvalid("prompt")
        const prices = options.map((option) => parsePrice(option.price))
        const bad = options.findIndex(
          (option, index) => !option.name.trim() || prices[index] === undefined
        )
        if (bad >= 0) {
          setBadOption(options[bad].key)
          return setInvalid("options")
        }
        setInvalid(null)
        setBadOption(null)
        const rule = CHOICES.find((item) => item.value === choice) ?? CHOICES[0]
        onSave({
          name: name.trim(),
          prompt: prompt.trim(),
          minSelect: rule.min,
          maxSelect: rule.max,
          serviceIds: services
            .map((service) => service.id)
            .filter((id) => serviceIds.includes(id)),
          options: options.map((option, index) => ({
            id: option.id,
            name: option.name.trim(),
            description: option.description.trim() || null,
            priceMinor: prices[index] ?? null,
            durationMinutes: Number(option.minutes),
          })),
        })
      }}
    >
      <FieldGroup>
        <Field data-invalid={invalid === "name" || undefined}>
          <FieldLabel htmlFor="extras-name">{c("name")}</FieldLabel>
          <Input
            {...noAutofill("extras_name")}
            id="extras-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxAddonName}
            placeholder={t("namePlaceholder")}
            aria-invalid={invalid === "name" || undefined}
          />
          {invalid === "name" && <FieldError>{c("addName")}</FieldError>}
        </Field>
        <Field data-invalid={invalid === "prompt" || undefined}>
          <FieldLabel htmlFor="extras-prompt">
            {t("question")}
          </FieldLabel>
          <Input
            {...noAutofill("extras_prompt")}
            id="extras-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={BOOKING_RULES.maxAddonPrompt}
            placeholder={t("questionPlaceholder")}
            aria-invalid={invalid === "prompt" || undefined}
          />
          {invalid === "prompt" && <FieldError>{t("addQuestion")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="extras-choice">{t("customersPick")}</FieldLabel>
          <AppSelect
            id="extras-choice"
            options={choices}
            value={choice}
            onValueChange={setChoice}
            className="w-full"
          />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">{t("options")}</FieldLegend>
          <FieldGroup className="gap-4">
            {options.map((option, index) => (
              <div key={option.key} className="flex flex-col gap-3">
                {index > 0 && <Separator />}
                <Field
                  data-invalid={
                    (badOption === option.key && !option.name.trim()) ||
                    undefined
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={`option-name-${option.key}`}>
                      {t("option", { n: index + 1 })}
                    </FieldLabel>
                    {options.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("removeOption", { n: index + 1 })}
                        onClick={() =>
                          setOptions((current) =>
                            current.filter((item) => item.key !== option.key)
                          )
                        }
                      >
                        <XIcon />
                      </Button>
                    )}
                  </div>
                  <Input
                    {...noAutofill("option_name")}
                    id={`option-name-${option.key}`}
                    value={option.name}
                    onChange={(event) =>
                      update(option.key, { name: event.target.value })
                    }
                    maxLength={BOOKING_RULES.maxAddonName}
                    placeholder={t("optionPlaceholder")}
                    aria-invalid={
                      (badOption === option.key && !option.name.trim()) ||
                      undefined
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...noAutofill("option_description")}
                    aria-label={t("optionDescription", { n: index + 1 })}
                    value={option.description}
                    onChange={(event) =>
                      update(option.key, { description: event.target.value })
                    }
                    maxLength={BOOKING_RULES.maxAddonDescription}
                    placeholder={t("descriptionPlaceholder")}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    data-invalid={
                      (badOption === option.key &&
                        parsePrice(option.price) === undefined) ||
                      undefined
                    }
                  >
                    <Input
                      {...noAutofill("option_price")}
                      aria-label={t("optionPrice", { n: index + 1 })}
                      inputMode="decimal"
                      value={option.price}
                      onChange={(event) =>
                        update(option.key, { price: event.target.value })
                      }
                      placeholder={t("pricePlaceholder")}
                    />
                  </Field>
                  <Field>
                    <AppSelect
                      options={minutesItems}
                      value={option.minutes}
                      onValueChange={(minutes) =>
                        update(option.key, { minutes })
                      }
                      aria-label={t("optionTime", { n: index + 1 })}
                      className="w-full"
                    />
                  </Field>
                </div>
              </div>
            ))}
            {invalid === "options" && (
              <FieldError>
                {t("optionsInvalid")}
              </FieldError>
            )}
            {options.length < BOOKING_RULES.maxAddonOptions && (
              <Button
                type="button"
                variant="ghost"
                className="self-start"
                onClick={() => {
                  setOptions((current) => [
                    ...current,
                    {
                      key: nextKey,
                      id: null,
                      name: "",
                      description: "",
                      price: "",
                      minutes: "0",
                    },
                  ])
                  setNextKey((value) => value + 1)
                }}
              >
                <PlusIcon data-icon="inline-start" />
                {t("addOption")}
              </Button>
            )}
          </FieldGroup>
        </FieldSet>

        {services.length > 0 && (
          <Field>
            <FieldLabel htmlFor="extras-services">{t("offeredWith")}</FieldLabel>
            <AppSelect
              multiple
              id="extras-services"
              options={serviceSelectOptions(
                services,
                categories,
                words("other")
              )}
              value={serviceIds}
              onValueChange={setServiceIds}
              className="w-full"
            />
          </Field>
        )}
      </FieldGroup>
    </form>
  )
}
