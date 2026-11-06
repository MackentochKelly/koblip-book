"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TagIcon,
  SparklesIcon,
  Trash2Icon,
} from "@/components/ui/icons"
import { toast } from "sonner"

import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { FilterChips } from "@/components/filter-chips"
import { ResponsivePanel } from "@/components/responsive-panel"
import { ViewTabs } from "@/components/view-tabs"
import { useShowFirst } from "@/hooks/use-show-first"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { AppSelect } from "@/components/app-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import {
  GOOGLE_EVENT_COLORS,
  eventColorOf,
  isGoogleEventColor,
  type GoogleEventColor,
} from "@/lib/google-calendar-colors"
import { CONTROL_SIZE } from "@/lib/control-size"
import { cn } from "@/lib/utils"
import { parsePrice } from "@/lib/parse-price"
import {
  groupServices,
  inGroupOrder,
  OTHER_GROUP,
  showsGroups,
} from "@/lib/service-groups"
import {
  createService,
  deleteService,
  reorderServices,
  suggestServices,
  updateService,
} from "../api/actions"
import { createAddonGroup, suggestAddonGroups } from "../api/addon-actions"
import {
  createServiceCategory,
  deleteServiceCategory,
  findOrAddServiceCategory,
  reorderServiceCategories,
  updateServiceCategory,
} from "../api/category-actions"
import { removeServicePhoto, setServicePhoto } from "../api/photo-actions"
import { setServiceTeam } from "../api/team-services"
import type {
  OwnerAddonGroup,
  OwnerServiceCategory,
  ServiceCategoryInput,
  ServiceInput,
} from "../types"
import { CATALOG_FIRST_SHOWN } from "../utils/catalog-list"
import { CategoriesPanel } from "./categories-panel"
import { ConfirmRemove } from "./confirm-remove"
import { ExtrasView } from "./extras-view"
import { ListFooter, ShowMore } from "./list-footer"
import { GoogleEventDot } from "./google-event-dot"
import { PhotoField } from "@/components/photo-upload"
import { useTabBarAction } from "./tab-bar-action"
import { noAutofill } from "@/lib/no-autofill"
import { useOwnerLanguage, useOwnerMessages } from "../i18n/provider"

interface ServiceRow {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceMinor: number | null
  photoUrl: string | null
  calendarColor: string | null
  // Null = Other (docs/plans/service-categories.md).
  categoryId: string | null
}

interface MemberRow {
  id: string
  name: string
}

const SERVICE_FORM = "service-form"
const CATEGORY_FORM = "category-form"

// "Calendar's colour" in the colour list, which needs a string.
const NO_COLOR = "" as const
// "No category" in the category list, which needs a string too.
const NO_CATEGORY = "" as const

// What the business sells: add, edit, reorder and remove services, or let
// Meta AI suggest the usual ones for this kind of business. Once there is a
// category, the list shows them in their categories' order, Other last;
// chips pick which it shows and the Categories button manages them.
export function ServicesView({
  businessId,
  currency,
  services,
  categories,
  team,
  serviceTeams,
  addonGroups,
  googleCalendar,
}: {
  businessId: string
  currency: string
  services: ServiceRow[]
  // In the owner's order; none = the flat list it always was.
  categories: OwnerServiceCategory[]
  team: MemberRow[]
  // serviceId → the members who do it; missing = everyone.
  serviceTeams: Record<string, string[]>
  addonGroups: OwnerAddonGroup[]
  // Whether Google Calendar is connected, so services get a colour (G7).
  googleCalendar: boolean
}) {
  const router = useRouter()
  const m = useOwnerMessages()
  const t = m.catalog.services
  const c = m.catalog.common
  const k = m.catalog.categories
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null)
  // The category a new service starts in: the one whose menu opened it.
  const [newCategoryId, setNewCategoryId] = useState<string>(NO_CATEGORY)
  const [formKey, setFormKey] = useState(0)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestKey, setSuggestKey] = useState(0)
  const [removing, setRemoving] = useState<ServiceRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState<"services" | "extras">("services")
  const [addingExtras, setAddingExtras] = useState(false)
  // Whether the open form differs from the saved service.
  const [changed, setChanged] = useState(false)
  const [editingCategory, setEditingCategory] = useState<
    OwnerServiceCategory | "new" | null
  >(null)
  const [categoryKey, setCategoryKey] = useState(0)
  // Whether the open category differs from the saved one, and whether the
  // last save found the name already used.
  const [categoryChanged, setCategoryChanged] = useState(false)
  const [categoryTaken, setCategoryTaken] = useState(false)
  const [removingCategory, setRemovingCategory] =
    useState<OwnerServiceCategory | null>(null)
  // The Categories panel, and the chip that is on (a category's id,
  // OTHER_GROUP for Other); null = All.
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [shownCategory, setShownCategory] = useState<string | null>(null)

  const openForm = (
    service: ServiceRow | "new",
    categoryId: string = NO_CATEGORY
  ) => {
    setFormKey((value) => value + 1)
    setNewCategoryId(categoryId)
    setEditing(service)
  }
  const openCategory = (category: OwnerServiceCategory | "new") => {
    setCategoryKey((value) => value + 1)
    setCategoryTaken(false)
    setEditingCategory(category)
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
  // Every category, even an empty one to add services to; with none it is
  // one group of every service, shown as the flat list it always was.
  const groups = groupServices(services, categories, { keepEmpty: true })
  const grouped = showsGroups(groups)
  // The chips: every group there is, in order. One that is on and since
  // removed no longer counts.
  const groupKey = (category: OwnerServiceCategory | null) =>
    category?.id ?? OTHER_GROUP
  const categoryOptions = groups.map(({ category }) => ({
    value: groupKey(category),
    label: category?.name ?? k.other,
  }))
  const shown = categoryOptions.some((option) => option.value === shownCategory)
    ? shownCategory
    : null
  const shows = (category: OwnerServiceCategory | null) =>
    shown === null || groupKey(category) === shown
  // With categories, one list of every service the filter shows, in the
  // categories' order; each keeps its group's index for Move up and down.
  const rows = groups.flatMap(({ category, services: list }, groupIndex) =>
    shows(category)
      ? list.map((service, index) => ({
          service,
          groupIndex,
          index,
          count: list.length,
        }))
      : []
  )
  // Up or down inside its group; the server gets every service in the new
  // shown order.
  const move = (groupIndex: number, index: number, by: number) => {
    const order = groups.map((group, at) => {
      if (at !== groupIndex) return group
      const moved = [...group.services]
      const [service] = moved.splice(index, 1)
      moved.splice(index + by, 0, service)
      return { ...group, services: moved }
    })
    run(() =>
      reorderServices(
        businessId,
        inGroupOrder(order).map((service) => service.id)
      )
    )
  }
  const moveCategory = (index: number, by: number) => {
    const ids = categories.map((category) => category.id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    run(() => reorderServiceCategories(businessId, ids))
  }
  // On a phone the tab bar's middle button adds a service (or extras).
  useTabBarAction({
    label: view === "services" ? t.addService : m.catalog.extras.add,
    onClick: () =>
      view === "services" ? openForm("new") : setAddingExtras(true),
    disabled: view === "extras" && services.length === 0,
  })
  const first = useShowFirst(services, CATALOG_FIRST_SHOWN)
  // A fresh set of suggestions each time the panel opens.
  const suggest = () => {
    setSuggestKey((value) => value + 1)
    setSuggesting(true)
  }
  // A phone's Suggest: after the last item, where the owner thinks of what
  // else to add; the computer's outline button, centred and as wide as its
  // words. Extras need a service first.
  const phoneSuggest = !(view === "extras" && services.length === 0) && (
    <Button variant="outline" className="md:hidden" onClick={suggest}>
      <SparklesIcon data-icon="inline-start" />
      {view === "services" ? t.suggestServices : t.suggestExtras}
    </Button>
  )

  // A category's colour, for its services that have none (C9).
  const categoryColor = (categoryId: string | null) =>
    categories.find((category) => category.id === categoryId)?.calendarColor ??
    null

  // One service's row, the same in a group or in the flat list. Move up and
  // down stay inside its group. Its dot is its events' colour.
  const serviceItem = (
    service: ServiceRow,
    groupIndex: number,
    index: number,
    count: number
  ) => {
    const color = googleCalendar
      ? eventColorOf(service.calendarColor, categoryColor(service.categoryId))
      : null
    return (
      <Item key={service.id} variant="outline">
        <ItemContent>
          <ItemTitle>
            {color && <GoogleEventDot color={color} />}
            {service.name}
          </ItemTitle>
          <ItemDescription>
            {formatDuration(service.durationMinutes)}
            {service.priceMinor !== null &&
              ` · ${service.priceMinor === 0 ? c.free : formatPrice(service.priceMinor, currency, m.locale)}`}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="outline"
            className={CONTROL_SIZE.button}
            onClick={() => openForm(service)}
          >
            {c.edit}
          </Button>
          <DropdownMenu>
            <MoreMenuTrigger
              label={c.more}
              size="icon"
              className={CONTROL_SIZE.icon}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={index === 0 || pending}
                  onClick={() => move(groupIndex, index, -1)}
                >
                  <ArrowUpIcon />
                  {c.moveUp}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === count - 1 || pending}
                  onClick={() => move(groupIndex, index, 1)}
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
                  onClick={() => setRemoving(service)}
                >
                  <Trash2Icon />
                  {c.remove}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* On a phone the top bar names the page, Suggest sits at the foot of
          the list and Add is the tab bar's middle button, so this header row
          is a computer's. */}
      <div className="flex flex-wrap items-center justify-between gap-3 max-md:contents">
        <h1 className="text-2xl font-semibold tracking-tight max-md:sr-only">{t.title}</h1>
        <div className="flex gap-2 max-md:hidden">
          <Button
            variant="outline"
            onClick={suggest}
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
        // As tall as the chips under them.
        listClassName={cn("w-full md:w-fit", CONTROL_SIZE.tabsList)}
        triggerClassName={CONTROL_SIZE.tab}
      />

      {/* The category chips, which scroll, then the Categories button that
          manages them, fixed at the row's end a little apart. */}
      {view === "services" && (
        <div className="flex items-center gap-3">
          {grouped && (
            <FilterChips
              label={k.title}
              all={k.all}
              options={categoryOptions}
              value={shown}
              onValueChange={setShownCategory}
              className="min-w-0 flex-1"
            />
          )}
          <Button
            variant="outline"
            className={cn("ml-auto", CONTROL_SIZE.button)}
            onClick={() => setCategoriesOpen(true)}
          >
            <TagIcon data-icon="inline-start" />
            {k.title}
          </Button>
        </div>
      )}

      {view === "extras" ? (
        <ExtrasView
          businessId={businessId}
          groups={addonGroups}
          services={services.map(({ id, name, categoryId }) => ({
            id,
            name,
            categoryId,
          }))}
          categories={categories}
          adding={addingExtras}
          onAddClosed={() => setAddingExtras(false)}
          phoneSuggest={phoneSuggest}
        />
      ) : services.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>{t.empty}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : grouped ? (
        rows.length === 0 ? (
          // Only empty categories are ticked.
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{k.noneShown}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => setShownCategory(null)}>
                {k.allServices}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          // Every service the filter shows, no Show more.
          <ItemGroup className="gap-3">
            {rows.map(({ service, groupIndex, index, count }) =>
              serviceItem(service, groupIndex, index, count)
            )}
          </ItemGroup>
        )
      ) : (
        // No category: one group of every service, with Show more.
        <ItemGroup className="gap-3">
          {first.shown.map((service, index) =>
            serviceItem(service, 0, index, services.length)
          )}
        </ItemGroup>
      )}

      {view === "services" && (
        <ListFooter
          showMore={!grouped && first.hidden > 0 && <ShowMore label={c.showMore(first.hidden)} onClick={first.showAll} />}
          suggest={phoneSuggest}
        />
      )}

      <ConfirmRemove
        name={removing?.name ?? null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          run(() => deleteService(businessId, removing.id), t.removed)
        }
      />

      <CategoriesPanel
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={groups.flatMap(({ category, services: list }) =>
          category ? [{ category, services: list.length }] : []
        )}
        googleCalendar={googleCalendar}
        pending={pending}
        onAdd={() => openCategory("new")}
        onAddService={(category) => {
          // The service form is the list's own, so this panel makes way.
          setCategoriesOpen(false)
          openForm("new", category.id)
        }}
        onEdit={openCategory}
        onMove={moveCategory}
        onRemove={setRemovingCategory}
      >
        {/* On top of the panel, back to it once done. */}
        <ConfirmRemove
          name={removingCategory?.name ?? null}
          description={k.movesToOther}
          onClose={() => setRemovingCategory(null)}
          onConfirm={() =>
            removingCategory &&
            run(
              () => deleteServiceCategory(businessId, removingCategory.id),
              k.removed
            )
          }
        />

        <ResponsivePanel
          open={editingCategory !== null}
          onClose={() => setEditingCategory(null)}
          title={editingCategory === "new" ? k.addTitle : k.editTitle}
          footer={
            <Button
              type="submit"
              size="lg"
              form={CATEGORY_FORM}
              disabled={
                pending || (editingCategory !== "new" && !categoryChanged)
              }
            >
              {pending && <Spinner data-icon="inline-start" />}
              {c.save}
            </Button>
          }
        >
          {editingCategory !== null && (
            <CategoryForm
              key={categoryKey}
              category={editingCategory === "new" ? null : editingCategory}
              googleCalendar={googleCalendar}
              taken={categoryTaken}
              onChanged={setCategoryChanged}
              onSave={(input) => {
                setCategoryTaken(false)
                startTransition(async () => {
                  const result =
                    editingCategory === "new"
                      ? await createServiceCategory(businessId, input)
                      : await updateServiceCategory(
                          businessId,
                          editingCategory.id,
                          input
                        )
                  if (result.ok) {
                    setEditingCategory(null)
                    toast.success(c.saved)
                    router.refresh()
                  } else if (result.error === "taken") {
                    setCategoryTaken(true)
                  } else {
                    toast.error(c.checkFields)
                  }
                })
              }}
            />
          )}
        </ResponsivePanel>
      </CategoriesPanel>

      <ResponsivePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t.addService : t.editService}
        footer={
          <Button
            type="submit"
            size="lg"
            form={SERVICE_FORM}
            disabled={pending || (editing !== "new" && !changed)}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {c.save}
          </Button>
        }
      >
        {editing !== null && (
          <ServiceForm
            key={formKey}
            service={editing === "new" ? null : editing}
            onChanged={setChanged}
            categories={categories}
            categoryId={editing === "new" ? newCategoryId : editing.categoryId}
            team={team}
            googleCalendar={googleCalendar}
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
  categories,
  categoryId: initialCategory,
  team,
  googleCalendar,
  memberIds: initialMembers,
  photo,
  onChanged,
  onSave,
}: {
  service: ServiceRow | null
  categories: OwnerServiceCategory[]
  // The one it starts in: the service's own, or for a new one the category
  // it was added from ("" or null = none).
  categoryId: string | null
  team: MemberRow[]
  googleCalendar: boolean
  memberIds: string[]
  photo: React.ReactNode
  onChanged: (changed: boolean) => void
  onSave: (input: ServiceInput, memberIds: string[]) => void
}) {
  const m = useOwnerMessages()
  const t = m.catalog.services
  const c = m.catalog.common
  const k = m.catalog.categories
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
  const savedColor = isGoogleEventColor(service?.calendarColor) ? service.calendarColor : NO_COLOR
  const [color, setColor] = useState<GoogleEventColor | typeof NO_COLOR>(savedColor)
  // None when it has none, or its category is gone.
  const savedCategory =
    categories.find((item) => item.id === initialCategory)?.id ?? NO_CATEGORY
  const [category, setCategory] = useState<string>(savedCategory)
  const categoryOptions = [
    { value: NO_CATEGORY, label: k.none },
    ...categories.map((item) => ({ value: item.id, label: item.name })),
  ]
  // No colour of its own takes the picked category's, if it has one.
  const categoryColor = eventColorOf(
    null,
    categories.find((item) => item.id === category)?.calendarColor
  )
  const [invalid, setInvalid] = useState<"name" | "price" | "team" | null>(null)
  const changed =
    name !== (service?.name ?? "") ||
    duration !== String(service?.durationMinutes ?? 30) ||
    price !==
      (service?.priceMinor != null ? String(service.priceMinor / 100) : "") ||
    description !== (service?.description ?? "") ||
    color !== savedColor ||
    category !== savedCategory ||
    [...memberIds].sort().join() !== [...initialMembers].sort().join()
  useEffect(() => onChanged(changed), [changed, onChanged])

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
            // Kept as it is while the form doesn't show it.
            ...(googleCalendar ? { calendarColor: color || null } : {}),
            ...(categories.length > 0 ? { categoryId: category || null } : {}),
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
        {categories.length > 0 && (
          <Field>
            <FieldLabel htmlFor="service-category">{k.category}</FieldLabel>
            <AppSelect
              id="service-category"
              options={categoryOptions}
              value={category}
              onValueChange={setCategory}
              className="w-full"
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="service-duration">{t.length}</FieldLabel>
            <AppSelect
              id="service-duration"
              options={durations}
              value={duration}
              onValueChange={setDuration}
              className="w-full"
            />
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
          <Field data-invalid={invalid === "team" || undefined}>
            <FieldLabel htmlFor="service-members">{t.whoDoesIt}</FieldLabel>
            <AppSelect
              multiple
              id="service-members"
              options={team.map((member) => ({
                value: member.id,
                label: member.name,
              }))}
              value={memberIds}
              onValueChange={setMemberIds}
              invalid={invalid === "team"}
              className="w-full"
            />
            {invalid === "team" && <FieldError>{t.pickOne}</FieldError>}
          </Field>
        )}
        {googleCalendar && (
          <CalendarColorField
            id="service-color"
            value={color}
            onChange={setColor}
            none={
              categoryColor
                ? { label: t.calendarColorCategory, color: categoryColor }
                : { label: t.calendarColorNone, color: null }
            }
          />
        )}
      </FieldGroup>
    </form>
  )
}

// The Google Calendar colour (G7) of a service or a category. `none` is
// what having no colour of its own gives: the calendar's, or for a service
// its category's.
function CalendarColorField({
  id,
  value,
  onChange,
  none,
}: {
  id: string
  value: GoogleEventColor | typeof NO_COLOR
  onChange: (value: GoogleEventColor | typeof NO_COLOR) => void
  none: { label: string; color: GoogleEventColor | null }
}) {
  const t = useOwnerMessages().catalog.services
  const options = [
    {
      value: NO_COLOR,
      label: none.label,
      icon: none.color && <GoogleEventDot color={none.color} />,
    },
    ...GOOGLE_EVENT_COLORS.map((color) => ({
      value: color,
      label: t.calendarColors[color],
      icon: <GoogleEventDot color={color} />,
    })),
  ]
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t.calendarColor}</FieldLabel>
      <AppSelect
        id={id}
        options={options}
        value={value}
        onValueChange={(picked) =>
          onChange(isGoogleEventColor(picked) ? picked : NO_COLOR)
        }
        className="w-full"
      />
    </Field>
  )
}

// A category's name, and with Google Calendar its colour for its services
// that have none (C9). `taken`: the last save found another category with
// that name.
function CategoryForm({
  category,
  googleCalendar,
  taken,
  onChanged,
  onSave,
}: {
  category: OwnerServiceCategory | null
  googleCalendar: boolean
  taken: boolean
  onChanged: (changed: boolean) => void
  onSave: (input: ServiceCategoryInput) => void
}) {
  const m = useOwnerMessages()
  const c = m.catalog.common
  const k = m.catalog.categories
  const [name, setName] = useState(category?.name ?? "")
  const [empty, setEmpty] = useState(false)
  const savedColor = isGoogleEventColor(category?.calendarColor)
    ? category.calendarColor
    : NO_COLOR
  const [color, setColor] = useState<GoogleEventColor | typeof NO_COLOR>(
    savedColor
  )
  const changed = name !== (category?.name ?? "") || color !== savedColor
  useEffect(() => onChanged(changed), [changed, onChanged])
  const invalid = empty || taken

  return (
    <form
      id={CATEGORY_FORM}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return setEmpty(true)
        setEmpty(false)
        onSave({
          name: name.trim(),
          // Kept as it is while the form doesn't show it.
          ...(googleCalendar ? { calendarColor: color || null } : {}),
        })
      }}
    >
      <FieldGroup>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="category-name">{c.name}</FieldLabel>
          <Input
            {...noAutofill("category_name")}
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={BOOKING_RULES.maxServiceCategoryName}
            placeholder={k.namePlaceholder}
            aria-invalid={invalid || undefined}
          />
          {invalid && <FieldError>{empty ? c.addName : k.taken}</FieldError>}
        </Field>
        {googleCalendar && (
          <CalendarColorField
            id="category-color"
            value={color}
            onChange={setColor}
            none={{ label: m.catalog.services.calendarColorNone, color: null }}
          />
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
              service.category,
              formatDuration(service.durationMinutes),
              service.description,
            ]
              .filter(Boolean)
              .join(" · "),
            // Into its category, added first when it is a new one; none
            // goes to Other.
            save: async () => {
              const category = service.category
                ? await findOrAddServiceCategory(businessId, service.category)
                : null
              if (category && !category.ok) return category
              return createService(businessId, {
                name: service.name,
                description: service.description,
                durationMinutes: service.durationMinutes,
                priceMinor: null,
                categoryId: category ? category.id : null,
              })
            },
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
          <Button size="lg" onClick={add} disabled={adding || ticked.length === 0}>
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
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t.aiOff}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : state.status === "failed" ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t.noSuggestions}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={retry}>
              {t.tryAgain}
            </Button>
          </EmptyContent>
        </Empty>
      ) : suggestions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t.nothingNew}</EmptyTitle>
          </EmptyHeader>
        </Empty>
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
