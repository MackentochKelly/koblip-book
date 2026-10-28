"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  ScissorsIcon,
  SparklesIcon,
  Trash2Icon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { ResponsivePanel } from "@/components/responsive-panel"
import { ViewTabs } from "@/components/view-tabs"
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
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { parsePrice } from "@/lib/parse-price"
import {
  createService,
  deleteService,
  reorderServices,
  suggestServices,
  updateService,
} from "../api/actions"
import { createAddonGroup, suggestAddonGroups } from "../api/addon-actions"
import { removeServicePhoto, setServicePhoto } from "../api/photo-actions"
import { setServiceTeam } from "../api/team-services"
import type { OwnerAddonGroup, ServiceInput } from "../types"
import { ExtrasView } from "./extras-view"
import { PhotoField } from "./photo-upload"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerLanguage, useOwnerMessages } from "../i18n/provider"

interface ServiceRow {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceMinor: number | null
  photoUrl: string | null
}

interface MemberRow {
  id: string
  name: string
}

const SERVICE_FORM = "service-form"

// What the business sells: add, edit, reorder and remove services, or let
// Meta AI suggest the usual ones for this kind of business.
export function ServicesView({
  businessId,
  currency,
  services,
  team,
  serviceTeams,
  addonGroups,
}: {
  businessId: string
  currency: string
  services: ServiceRow[]
  team: MemberRow[]
  // serviceId → the members who do it; missing = everyone.
  serviceTeams: Record<string, string[]>
  addonGroups: OwnerAddonGroup[]
}) {
  const router = useRouter()
  const m = useOwnerMessages()
  const t = m.catalog.services
  const c = m.catalog.common
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestKey, setSuggestKey] = useState(0)
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState<"services" | "extras">("services")
  const [addingExtras, setAddingExtras] = useState(false)

  const openForm = (service: ServiceRow | "new") => {
    setFormKey((value) => value + 1)
    setEditing(service)
  }
  const run = (task: () => Promise<{ ok: boolean }>, done?: string) =>
    startTransition(async () => {
      const result = await task()
      if (result.ok) {
        if (done) toast.success(done)
        router.refresh()
      } else {
        toast.error(c.failed)
      }
    })
  const move = (index: number, by: number) => {
    const ids = services.map((service) => service.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    run(() => reorderServices(businessId, ids))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSuggestKey((value) => value + 1)
              setSuggesting(true)
            }}
            disabled={view === "extras" && services.length === 0}
          >
            <SparklesIcon data-icon="inline-start" />
            {t.suggest}
          </Button>
          <Button
            onClick={() =>
              view === "services" ? openForm("new") : setAddingExtras(true)
            }
            disabled={view === "extras" && services.length === 0}
          >
            <PlusIcon data-icon="inline-start" />
            {c.add}
          </Button>
        </div>
      </div>
      <ViewTabs
        views={[
          { id: "services" as const, label: t.tabs.services },
          { id: "extras" as const, label: t.tabs.extras },
        ]}
        value={view}
        onChange={setView}
        ariaLabel={t.tabs.label}
        listClassName="w-full"
      />

      {view === "extras" ? (
        <ExtrasView
          businessId={businessId}
          groups={addonGroups}
          services={services.map(({ id, name }) => ({ id, name }))}
          adding={addingExtras}
          onAddClosed={() => setAddingExtras(false)}
        />
      ) : services.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScissorsIcon />
            </EmptyMedia>
            <EmptyTitle>{t.empty}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => openForm("new")}>{t.addService}</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {services.map((service, index) => (
            <Item key={service.id} variant="outline">
              <ItemContent>
                <ItemTitle>{service.name}</ItemTitle>
                <ItemDescription>
                  {formatDuration(service.durationMinutes)}
                  {service.priceMinor !== null &&
                    ` · ${service.priceMinor === 0 ? c.free : formatPrice(service.priceMinor, currency, m.locale)}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openForm(service)}
                >
                  {c.edit}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={c.more}
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
                        {c.moveUp}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === services.length - 1 || pending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon />
                        {c.moveDown}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => deleteService(businessId, service.id),
                            t.removed
                          )
                        }
                      >
                        <Trash2Icon />
                        {c.remove}
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
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t.addService : t.editService}
        footer={
          <Button type="submit" form={SERVICE_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {c.save}
          </Button>
        }
      >
        {editing !== null && (
          <ServiceForm
            key={formKey}
            service={editing === "new" ? null : editing}
            team={team}
            memberIds={
              editing === "new"
                ? team.map((member) => member.id)
                : (serviceTeams[editing.id] ?? team.map((member) => member.id))
            }
            photo={
              editing !== "new" && (
                <PhotoField
                  label={t.photo(editing.name)}
                  photoUrl={editing.photoUrl}
                  upload={(formData) =>
                    setServicePhoto(businessId, editing.id, formData)
                  }
                  remove={() => removeServicePhoto(businessId, editing.id)}
                />
              )
            }
            onSave={(input, memberIds) =>
              startTransition(async () => {
                let serviceId: string | null = null
                let saved: { ok: boolean }
                if (editing === "new") {
                  const created = await createService(businessId, input)
                  if (created.ok) serviceId = created.id
                  saved = created
                } else {
                  saved = await updateService(businessId, editing.id, input)
                  serviceId = editing.id
                }
                // Everyone ticked = no list (everyone, also new people later).
                const result =
                  saved.ok && serviceId && team.length > 1
                    ? await setServiceTeam(
                        businessId,
                        serviceId,
                        memberIds.length === team.length ? [] : memberIds
                      )
                    : saved
                if (result.ok) {
                  setEditing(null)
                  toast.success(c.saved)
                  router.refresh()
                } else {
                  toast.error(c.checkFields)
                }
              })
            }
          />
        )}
      </ResponsivePanel>

      <SuggestPanel
        key={suggestKey}
        kind={view}
        open={suggesting}
        businessId={businessId}
        onClose={() => setSuggesting(false)}
        onAdded={() => {
          setSuggesting(false)
          router.refresh()
        }}
      />
    </div>
  )
}

function ServiceForm({
  service,
  team,
  memberIds: initialMembers,
  photo,
  onSave,
}: {
  service: ServiceRow | null
  team: MemberRow[]
  memberIds: string[]
  photo: React.ReactNode
  onSave: (input: ServiceInput, memberIds: string[]) => void
}) {
  const m = useOwnerMessages()
  const t = m.catalog.services
  const c = m.catalog.common
  const durations = BOOKING_RULES.serviceMinutes.map((minutes) => ({
    value: String(minutes),
    label: formatDuration(minutes),
  }))
  const [name, setName] = useState(service?.name ?? "")
  const [duration, setDuration] = useState(
    String(service?.durationMinutes ?? 30)
  )
  const [price, setPrice] = useState(
    service?.priceMinor != null ? String(service.priceMinor / 100) : ""
  )
  const [description, setDescription] = useState(service?.description ?? "")
  const [memberIds, setMemberIds] = useState(initialMembers)
  const [invalid, setInvalid] = useState<"name" | "price" | "team" | null>(null)

  return (
    <form
      id={SERVICE_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const priceMinor = parsePrice(price)
        if (!name.trim()) return setInvalid("name")
        if (priceMinor === undefined) return setInvalid("price")
        if (team.length > 1 && memberIds.length === 0) return setInvalid("team")
        setInvalid(null)
        onSave(
          {
            name: name.trim(),
            description: description.trim() || null,
            durationMinutes: Number(duration),
            priceMinor,
          },
          memberIds
        )
      }}
    >
      <FieldGroup>
        {photo}
        <Field data-invalid={invalid === "name" || undefined}>
          <FieldLabel htmlFor="service-name">{c.name}</FieldLabel>
          <Input
            {...noAutofill("service_name")}
            id="service-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxServiceName}
            aria-invalid={invalid === "name" || undefined}
          />
          {invalid === "name" && <FieldError>{c.addName}</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="service-duration">{t.length}</FieldLabel>
            <Select
              items={durations}
              value={duration}
              onValueChange={(value) => value && setDuration(String(value))}
            >
              <SelectTrigger id="service-duration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durations.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field data-invalid={invalid === "price" || undefined}>
            <FieldLabel htmlFor="service-price">{t.price}</FieldLabel>
            <Input
              {...noAutofill("service_price")}
              id="service-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder={c.optional}
              aria-invalid={invalid === "price" || undefined}
            />
            {invalid === "price" && <FieldError>{t.useNumber}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="service-description">{t.description}</FieldLabel>
          <Textarea
            {...noAutofill("service_description")}
            id="service-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={BOOKING_RULES.maxServiceDescription}
            placeholder={c.optional}
          />
        </Field>
        {team.length > 1 && (
          <FieldSet data-invalid={invalid === "team" || undefined}>
            <FieldLegend variant="label">{t.whoDoesIt}</FieldLegend>
            <FieldGroup data-slot="checkbox-group">
              {team.map((member) => (
                <Field key={member.id} orientation="horizontal">
                  <Checkbox
                    id={`service-member-${member.id}`}
                    checked={memberIds.includes(member.id)}
                    onCheckedChange={(on) =>
                      setMemberIds((current) =>
                        on
                          ? team
                              .map((item) => item.id)
                              .filter(
                                (id) => id === member.id || current.includes(id)
                              )
                          : current.filter((id) => id !== member.id)
                      )
                    }
                  />
                  <FieldLabel
                    htmlFor={`service-member-${member.id}`}
                    className="font-normal"
                  >
                    {member.name}
                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>
            {invalid === "team" && <FieldError>{t.pickOne}</FieldError>}
          </FieldSet>
        )}
      </FieldGroup>
    </form>
  )
}

// What Meta AI suggests, in the owner's language: services, or extras for
// the services there are. Each is ticked to start; Add saves the ticked ones.
type Suggestion = {
  name: string
  detail: string
  save: () => Promise<{ ok: boolean }>
}

function SuggestPanel({
  kind,
  open,
  businessId,
  onClose,
  onAdded,
}: {
  kind: "services" | "extras"
  open: boolean
  businessId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [state, setState] = useState<
    | { status: "loading" | "failed" | "off" }
    | { status: "ready"; items: Suggestion[] }
  >({ status: "loading" })
  const m = useOwnerMessages()
  const t = m.catalog.services
  const [language] = useOwnerLanguage()
  const [ticked, setTicked] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [adding, startAdding] = useTransition()

  // Asked once per opening (the panel gets a new key each time it opens).
  useEffect(() => {
    if (!open) return
    let live = true
    const load = async (): Promise<
      { ok: true; items: Suggestion[] } | { ok: false; error: string }
    > => {
      if (kind === "services") {
        const result = await suggestServices(businessId, language)
        if (!result.ok) return result
        return {
          ok: true,
          items: result.services.map((service) => ({
            name: service.name,
            detail: [
              formatDuration(service.durationMinutes),
              service.description,
            ]
              .filter(Boolean)
              .join(" · "),
            save: () =>
              createService(businessId, {
                name: service.name,
                description: service.description,
                durationMinutes: service.durationMinutes,
                priceMinor: null,
              }),
          })),
        }
      }
      const result = await suggestAddonGroups(businessId, language)
      if (!result.ok) return result
      return {
        ok: true,
        items: result.groups.map((group) => ({
          name: group.name,
          detail: group.options.map((option) => option.name).join(", "),
          save: () =>
            createAddonGroup(businessId, {
              ...group,
              options: group.options.map((option) => ({
                ...option,
                id: null,
                priceMinor: null,
              })),
            }),
        })),
      }
    }
    load()
      .catch(() => null)
      .then((result) => {
        if (!live) return
        if (result?.ok) {
          setState({ status: "ready", items: result.items })
          setTicked(result.items.map((item) => item.name))
        } else {
          setState({
            status: result && result.error === "ai_off" ? "off" : "failed",
          })
        }
      })
    return () => {
      live = false
    }
  }, [open, kind, businessId, language, attempt])
  const suggestions = state.status === "ready" ? state.items : []
  const retry = () => {
    setState({ status: "loading" })
    setAttempt((value) => value + 1)
  }

  const add = () =>
    startAdding(async () => {
      for (const item of suggestions.filter((found) =>
        ticked.includes(found.name)
      )) {
        const result = await item.save()
        if (!result.ok) {
          toast.error(
            kind === "services" ? t.someFailed : m.catalog.extras.someFailed
          )
          break
        }
      }
      onAdded()
    })

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={kind === "services" ? t.suggested : m.catalog.extras.suggested}
      footer={
        suggestions.length > 0 ? (
          <Button onClick={add} disabled={adding || ticked.length === 0}>
            {adding && <Spinner data-icon="inline-start" />}
            {t.addCount(ticked.length)}
          </Button>
        ) : undefined
      }
    >
      {state.status === "loading" ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : state.status === "off" ? (
        <p className="text-sm text-muted-foreground">{t.aiOff}</p>
      ) : state.status === "failed" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t.noSuggestions}</p>
          <Button variant="outline" onClick={retry}>
            {t.tryAgain}
          </Button>
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.nothingNew}</p>
      ) : (
        <FieldGroup className="gap-3">
          {suggestions.map((item) => (
            <FieldLabel key={item.name} htmlFor={`suggest-${item.name}`}>
              <Field orientation="horizontal">
                <Checkbox
                  id={`suggest-${item.name}`}
                  checked={ticked.includes(item.name)}
                  onCheckedChange={(on) =>
                    setTicked((current) =>
                      on
                        ? [...current, item.name]
                        : current.filter((name) => name !== item.name)
                    )
                  }
                />
                <FieldContent>
                  <FieldTitle>{item.name}</FieldTitle>
                  {item.detail && (
                    <FieldDescription>{item.detail}</FieldDescription>
                  )}
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </FieldGroup>
      )}
    </ResponsivePanel>
  )
}
