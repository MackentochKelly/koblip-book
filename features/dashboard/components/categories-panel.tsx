"use client"

import { useTranslations } from "next-intl"

import { ResponsivePanel } from "@/components/responsive-panel"
import { MoreMenuTrigger } from "@/components/more-menu-trigger"
import { Button } from "@/components/ui/button"
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
  ItemTitle,
} from "@/components/ui/item"
import { isGoogleEventColor } from "@/lib/google-calendar-colors"
import type { OwnerServiceCategory } from "../types"
import { GoogleEventDot } from "./google-event-dot"

export interface CategoryCount {
  category: OwnerServiceCategory
  services: number
}

// The one place to manage the Services screen's categories, opened by its
// Categories button (the chips beside it pick which ones the list shows):
// every category with how many services it has and its ⋮ menu (Add a
// service, Edit, Move up, Move down, Remove), Add category at the foot. A
// form or a confirm opened from here is passed as `children`, so it opens
// on top of this panel and comes back to it.
export function CategoriesPanel({
  open,
  onClose,
  categories,
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
  // In the owner's order.
  categories: CategoryCount[]
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
  const t = useTranslations("owner.catalog")
  const menu = (category: OwnerServiceCategory, index: number) => (
    <DropdownMenu>
      <MoreMenuTrigger label={t("common.more")} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onAddService(category)}>
            <PlusIcon />
            {t("services.addService")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(category)}>
            <SquarePenIcon />
            {t("common.edit")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={index === 0 || pending}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUpIcon />
            {t("common.moveUp")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === categories.length - 1 || pending}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDownIcon />
            {t("common.moveDown")}
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
            {t("common.remove")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <ResponsivePanel
      open={open}
      onClose={onClose}
      title={t("categories.title")}
      footer={
        <Button size="lg" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t("categories.add")}
        </Button>
      }
    >
      {categories.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("categories.empty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-3">
          {categories.map(({ category, services }, index) => (
            <Item key={category.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  {googleCalendar &&
                    isGoogleEventColor(category.calendarColor) && (
                      <GoogleEventDot color={category.calendarColor} />
                    )}
                  {category.name}
                </ItemTitle>
              </ItemContent>
              <ItemActions>
                <span className="text-muted-foreground tabular-nums">
                  {services}
                </span>
                {menu(category, index)}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
      {children}
    </ResponsivePanel>
  )
}
