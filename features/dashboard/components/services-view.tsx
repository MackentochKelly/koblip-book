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
} from "lucide-react"
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
import { removeServicePhoto, setServicePhoto } from "../api/photo-actions"
import { setServiceTeam } from "../api/team-services"
import type { OwnerAddonGroup, ServiceInput, ServiceSuggestion } from "../types"
import { ExtrasView } from "./extras-view"
import { PhotoField } from "./photo-upload"

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

const DURATIONS = BOOKING_RULES.serviceMinutes.map((minutes) => ({
  value: String(minutes),
  label: formatDuration(minutes),
}))

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
        toast.error("That did not work. Please try again.")
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
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <div className="flex gap-2">
          {view === "services" && (
            <Button
              variant="outline"
              onClick={() => {
                setSuggestKey((value) => value + 1)
                setSuggesting(true)
              }}
            >
              <SparklesIcon data-icon="inline-start" />
              Suggest
            </Button>
          )}
          <Button
            onClick={() =>
              view === "services" ? openForm("new") : setAddingExtras(true)
            }
            disabled={view === "extras" && services.length === 0}
          >
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
      </div>
      <ViewTabs
        views={[
          { id: "services" as const, label: "Services" },
          { id: "extras" as const, label: "Extras" },
        ]}
        value={view}
        onChange={setView}
        ariaLabel="Services and extras"
        variant="line"
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
            <EmptyTitle>No services yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => openForm("new")}>Add a service</Button>
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
                    ` · ${service.priceMinor === 0 ? "Free" : formatPrice(service.priceMinor, currency)}`}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openForm(service)}
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
                        disabled={index === services.length - 1 || pending}
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
                            () => deleteService(businessId, service.id),
                            "Service removed"
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
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add a service" : "Edit service"}
        footer={
          <Button type="submit" form={SERVICE_FORM} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Save
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
                  label={`${editing.name} photo`}
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

      <SuggestPanel
        key={suggestKey}
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
          <FieldLabel htmlFor="service-name">Name</FieldLabel>
          <Input
            id="service-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxServiceName}
            aria-invalid={invalid === "name" || undefined}
          />
          {invalid === "name" && <FieldError>Add a name</FieldError>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="service-duration">Length</FieldLabel>
            <Select
              items={DURATIONS}
              value={duration}
              onValueChange={(value) => value && setDuration(String(value))}
            >
              <SelectTrigger id="service-duration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field data-invalid={invalid === "price" || undefined}>
            <FieldLabel htmlFor="service-price">Price</FieldLabel>
            <Input
              id="service-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Optional"
              aria-invalid={invalid === "price" || undefined}
            />
            {invalid === "price" && <FieldError>Use a number</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="service-description">Description</FieldLabel>
          <Textarea
            id="service-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={BOOKING_RULES.maxServiceDescription}
            placeholder="Optional"
          />
        </Field>
        {team.length > 1 && (
          <FieldSet data-invalid={invalid === "team" || undefined}>
            <FieldLegend variant="label">Who does it</FieldLegend>
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
            {invalid === "team" && <FieldError>Pick at least one</FieldError>}
          </FieldSet>
        )}
      </FieldGroup>
    </form>
  )
}

// Meta AI's usual services for this kind of business; the owner ticks the
// ones to add. Nothing is saved until Add.
function SuggestPanel({
  open,
  businessId,
  onClose,
  onAdded,
}: {
  open: boolean
  businessId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [state, setState] = useState<
    | { status: "loading" | "failed" | "off" }
    | { status: "ready"; services: ServiceSuggestion[] }
  >({ status: "loading" })
  const [ticked, setTicked] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [adding, startAdding] = useTransition()

  // Asked once per opening (the panel gets a new key each time it opens).
  useEffect(() => {
    if (!open) return
    let live = true
    suggestServices(businessId)
      .catch(() => null)
      .then((result) => {
        if (!live) return
        if (result?.ok) {
          setState({ status: "ready", services: result.services })
          setTicked(result.services.map((service) => service.name))
        } else {
          setState({
            status: result && result.error === "ai_off" ? "off" : "failed",
          })
        }
      })
    return () => {
      live = false
    }
  }, [open, businessId, attempt])
  const suggestions = state.status === "ready" ? state.services : []
  const retry = () => {
    setState({ status: "loading" })
    setAttempt((value) => value + 1)
  }

  const add = () =>
    startAdding(async () => {
      if (state.status !== "ready") return
      for (const service of state.services.filter((item) =>
        ticked.includes(item.name)
      )) {
        const result = await createService(businessId, {
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          priceMinor: null,
        })
        if (!result.ok) {
          toast.error("Some services could not be added.")
          break
        }
      }
      onAdded()
    })

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title="Suggested services"
      footer={
        state.status === "ready" && state.services.length > 0 ? (
          <Button onClick={add} disabled={adding || ticked.length === 0}>
            {adding && <Spinner data-icon="inline-start" />}
            Add {ticked.length}
          </Button>
        ) : undefined
      }
    >
      {state.status === "loading" ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : state.status === "off" ? (
        <p className="text-sm text-muted-foreground">Meta AI is off.</p>
      ) : state.status === "failed" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            No suggestions right now.
          </p>
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing new to suggest.</p>
      ) : (
        <FieldGroup className="gap-3">
          {suggestions.map((service) => (
            <FieldLabel key={service.name} htmlFor={`suggest-${service.name}`}>
              <Field orientation="horizontal">
                <Checkbox
                  id={`suggest-${service.name}`}
                  checked={ticked.includes(service.name)}
                  onCheckedChange={(on) =>
                    setTicked((current) =>
                      on
                        ? [...current, service.name]
                        : current.filter((name) => name !== service.name)
                    )
                  }
                />
                <FieldContent>
                  <FieldTitle>{service.name}</FieldTitle>
                  <FieldDescription>
                    {formatDuration(service.durationMinutes)}
                    {service.description && ` · ${service.description}`}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </FieldGroup>
      )}
    </ResponsivePanel>
  )
}
