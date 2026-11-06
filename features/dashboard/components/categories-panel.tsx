"use client"

import { ResponsivePanel } from "@/components/responsive-panel"
import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  SquarePenIcon,
  Trash2Icon,
} from "@/components/ui/icons"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Label } from "@/components/ui/label"
import { isGoogleEventColor } from "@/lib/google-calendar-colors"
import { OTHER_GROUP } from "@/lib/service-groups"
import type { OwnerServiceCategory } from "../types"
import { useOwnerMessages } from "../i18n/provider"
import { GoogleEventDot } from "./google-event-dot"

export interface CategoryCount {
  // Null = Other, the services with no category (only when there are some).
  category: OwnerServiceCategory | null
  services: number
}

// Everything about the Services screen's categories in one panel, opened
// by its Categories button: which ones the list shows (several at once, All
// services = every one) and each category's own ⋮ menu (Add a service,
// Edit, Move up, Move down, Remove), with Add category at the foot. A form
// or a confirm opened from here is passed as `children`, so it opens on
// top of this panel and comes back to it.
export function CategoriesPanel({
  open,
  onClose,
  groups,
  total,
  shown,
  onShownChange,
  googleCalendar,
  pending,
  onAdd,
  onAddService,
  onEdit,
  onMove,
  onRemove,
  children,
}: {
  open: boolean
  onClose: () => void
  // Every category in the owner's order, then Other.
  groups: CategoryCount[]
  // How many services there are in all.
  total: number
  // The groups the list shows (a category's id, OTHER_GROUP for Other);
  // none = every one.
  shown: readonly string[]
  onShownChange: (shown: string[]) => void
  googleCalendar: boolean
  pending: boolean
  onAdd: () => void
  onAddService: (category: OwnerServiceCategory) => void
  onEdit: (category: OwnerServiceCategory) => void
  // A category's place among the categories, up (-1) or down (1).
  onMove: (index: number, by: number) => void
  onRemove: (category: OwnerServiceCategory) => void
  children?: React.ReactNode
}) {
  const m = useOwnerMessages()
  const k = m.catalog.categories
  const c = m.catalog.common
  const categories = groups.flatMap(({ category }) =>
    category ? [category] : []
  )
  const keyOf = (category: OwnerServiceCategory | null) =>
    category?.id ?? OTHER_GROUP
  // Ticked or not, the shown ones stay in the groups' order.
  const tick = (key: string, on: boolean) =>
    onShownChange(
      groups
        .map(({ category }) => keyOf(category))
        .filter((item) => (item === key ? on : shown.includes(item)))
    )

  const menu = (category: OwnerServiceCategory, index: number) => (
    <DropdownMenu>
      <MoreMenuTrigger label={c.more} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAddService(category)}>
            <PlusIcon />
            {m.catalog.services.addService}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(category)}>
            <SquarePenIcon />
            {c.edit}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={index === 0 || pending}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUpIcon />
            {c.moveUp}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === categories.length - 1 || pending}
            onClick={() => onMove(index, 1)}
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
            onClick={() => onRemove(category)}
          >
            <Trash2Icon />
            {c.remove}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={k.title}
      footer={
        <Button size="lg" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {k.add}
        </Button>
      }
    >
      {categories.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{k.empty}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          <Row
            id="categories-all"
            label={k.all}
            count={total}
            checked={shown.length === 0}
            // Ticking it shows every service; it can't be unticked.
            onCheckedChange={(on) => on && onShownChange([])}
          />
          {groups.map(({ category, services }, index) => (
            <Row
              key={keyOf(category)}
              id={`categories-${keyOf(category)}`}
              label={category?.name ?? k.other}
              dot={
                googleCalendar &&
                isGoogleEventColor(category?.calendarColor) && (
                  <GoogleEventDot color={category.calendarColor} />
                )
              }
              count={services}
              checked={shown.includes(keyOf(category))}
              onCheckedChange={(on) => tick(keyOf(category), on)}
              // Categories come first, so a category's index is its own.
              menu={category && menu(category, index)}
            />
          ))}
        </ItemGroup>
      )}
      {children}
    </ResponsivePanel>
  )
}

// One row: its box, its name and how many services it has, then its ⋮
// menu. The name's label covers the whole row, so a tap anywhere but the
// menu ticks the box.
function Row({
  id,
  label,
  dot,
  count,
  checked,
  onCheckedChange,
  menu,
}: {
  id: string
  label: string
  dot?: React.ReactNode
  count: number
  checked: boolean
  onCheckedChange: (on: boolean) => void
  menu?: React.ReactNode
}) {
  return (
    <Item variant="outline" className="relative">
      <ItemMedia>
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <Label htmlFor={id} className="after:absolute after:inset-0">
            {dot}
            {label}
          </Label>
        </ItemTitle>
      </ItemContent>
      {/* As tall as the ⋮ button, so a row without one matches. */}
      <ItemActions className="min-h-8">
        <span className="text-muted-foreground tabular-nums">{count}</span>
        {/* Above the label that covers the row. */}
        {menu && <div className="relative">{menu}</div>}
      </ItemActions>
    </Item>
  )
}
