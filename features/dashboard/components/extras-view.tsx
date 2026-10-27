"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { parsePrice } from "@/lib/parse-price"
import {
  createAddonGroup,
  deleteAddonGroup,
  reorderAddonGroups,
  updateAddonGroup,
} from "../api/addon-actions"
import type { AddonGroupInput, OwnerAddonGroup } from "../types"
import { noAutofill } from "@/lib/no-autofill"

const FORM = "extras-form"

// How many a customer picks from a group, as four plain choices.
const CHOICES = [
  { value: "any", label: "Optional, any", min: 0, max: null },
  { value: "one", label: "Optional, one", min: 0, max: 1 },
  { value: "must-one", label: "Required, one", min: 1, max: 1 },
  { value: "must-any", label: "Required, one or more", min: 1, max: null },
] as const

const MINUTES = BOOKING_RULES.addonMinutes.map((minutes) => ({
  value: String(minutes),
  label: minutes === 0 ? "No extra time" : `+${formatDuration(minutes)}`,
}))

function choiceOf(group: { minSelect: number; maxSelect: number | null }) {
  return (
    CHOICES.find(
      (choice) =>
        choice.min === Math.min(group.minSelect, 1) &&
        choice.max === (group.maxSelect === 1 ? 1 : null)
    ) ?? CHOICES[0]
  )
}

// Extras a customer can add to a service (Fresha's add-ons): a group with
// a question, its options, and the services it is offered with.
export function ExtrasView({
  businessId,
  groups,
  services,
  adding,
  onAddClosed,
}: {
  businessId: string
  groups: OwnerAddonGroup[]
  services: { id: string; name: string }[]
  // The page's Add button opens a new group here.
  adding: boolean
  onAddClosed: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<OwnerAddonGroup | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pending, startTransition] = useTransition()
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
        toast.error("That did not work. Please try again.")
      }
    })
  const move = (index: number, by: number) => {
    const ids = groups.map((group) => group.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    run(() => reorderAddonGroups(businessId, ids))
  }

  return (
    <>
      {groups.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>No extras yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {groups.map((group, index) => (
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
                  size="sm"
                  onClick={() => {
                    setFormKey((value) => value + 1)
                    setEditing(group)
                  }}
                >
                  Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="More"
                      />
                    }
                  >
                    <EllipsisVerticalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={index === 0 || pending}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUpIcon />
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === groups.length - 1 || pending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon />
                        Move down
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => deleteAddonGroup(businessId, group.id),
                            "Extras removed"
                          )
                        }
                      >
                        <Trash2Icon />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      <ResponsivePanel
        open={panelOpen}
        onClose={closePanel}
        title={editing ? "Edit extras" : "Add extras"}
        footer={
          <Button type="submit" form={FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        }
      >
        {panelOpen && (
          <ExtrasForm
            key={`${formKey}-${editing?.id ?? "new"}-${adding}`}
            group={editing}
            services={services}
            onSave={(input) =>
              startTransition(async () => {
                const result = await (
                  editing
                    ? updateAddonGroup(businessId, editing.id, input)
                    : createAddonGroup(businessId, input)
                ).catch(() => ({ ok: false }))
                if (result.ok) {
                  closePanel()
                  toast.success("Saved")
                  router.refresh()
                } else {
                  toast.error("Could not save. Check the fields.")
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
  onSave,
}: {
  group: OwnerAddonGroup | null
  services: { id: string; name: string }[]
  onSave: (input: AddonGroupInput) => void
}) {
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

  const update = (key: number, change: Partial<OptionDraft>) =>
    setOptions((current) =>
      current.map((option) =>
        option.key === key ? { ...option, ...change } : option
      )
    )
  const choices = CHOICES.map(({ value, label }) => ({ value, label }))

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
          <FieldLabel htmlFor="extras-name">Name</FieldLabel>
          <Input
            {...noAutofill("extras_name")}
            id="extras-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxAddonName}
            placeholder="Beard extras"
            aria-invalid={invalid === "name" || undefined}
          />
          {invalid === "name" && <FieldError>Add a name</FieldError>}
        </Field>
        <Field data-invalid={invalid === "prompt" || undefined}>
          <FieldLabel htmlFor="extras-prompt">
            Question for customers
          </FieldLabel>
          <Input
            {...noAutofill("extras_prompt")}
            id="extras-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={BOOKING_RULES.maxAddonPrompt}
            placeholder="Add an extra?"
            aria-invalid={invalid === "prompt" || undefined}
          />
          {invalid === "prompt" && <FieldError>Add a question</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="extras-choice">Customers pick</FieldLabel>
          <Select
            items={choices}
            value={choice}
            onValueChange={(value) => value && setChoice(String(value))}
          >
            <SelectTrigger id="extras-choice" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Options</FieldLegend>
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
                      Option {index + 1}
                    </FieldLabel>
                    {options.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove option ${index + 1}`}
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
                    placeholder="Beard trim"
                    aria-invalid={
                      (badOption === option.key && !option.name.trim()) ||
                      undefined
                    }
                  />
                </Field>
                <Field>
                  <Input
                    {...noAutofill("option_description")}
                    aria-label={`Option ${index + 1} description`}
                    value={option.description}
                    onChange={(event) =>
                      update(option.key, { description: event.target.value })
                    }
                    maxLength={BOOKING_RULES.maxAddonDescription}
                    placeholder="Short description (optional)"
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
                      aria-label={`Option ${index + 1} extra price`}
                      inputMode="decimal"
                      value={option.price}
                      onChange={(event) =>
                        update(option.key, { price: event.target.value })
                      }
                      placeholder="+ Price"
                    />
                  </Field>
                  <Field>
                    <Select
                      items={MINUTES}
                      value={option.minutes}
                      onValueChange={(value) =>
                        value && update(option.key, { minutes: String(value) })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Option ${index + 1} extra time`}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
            {invalid === "options" && (
              <FieldError>
                Each option needs a name and a valid price
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
                Add option
              </Button>
            )}
          </FieldGroup>
        </FieldSet>

        {services.length > 0 && (
          <FieldSet>
            <FieldLegend variant="label">Offered with</FieldLegend>
            <FieldGroup data-slot="checkbox-group">
              {services.map((service) => (
                <Field key={service.id} orientation="horizontal">
                  <Checkbox
                    id={`extras-service-${service.id}`}
                    checked={serviceIds.includes(service.id)}
                    onCheckedChange={(on) =>
                      setServiceIds((current) =>
                        on
                          ? [...current, service.id]
                          : current.filter((id) => id !== service.id)
                      )
                    }
                  />
                  <FieldLabel
                    htmlFor={`extras-service-${service.id}`}
                    className="font-normal"
                  >
                    {service.name}
                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
        )}
      </FieldGroup>
    </form>
  )
}
