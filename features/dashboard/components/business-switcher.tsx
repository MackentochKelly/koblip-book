"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import type { Route } from "next"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  StoreIcon,
} from "@/components/ui/icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { OwnedBusiness } from "../types"

// The menu's top, as shadcn's sidebar-07 TeamSwitcher: the open business
// and its type (as Google Maps names it), opening the owner's other businesses and Add business. Switching keeps
// the same part of the dashboard (Services stays Services).
export function BusinessSwitcher({
  current,
  businesses,
}: {
  current: { id: string; name: string }
  businesses: OwnedBusiness[]
}) {
  const t = useTranslations("owner.shell.businesses")
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = usePathname()
  const base = `/dashboard/${current.id}`
  // Only the first part after the business (/services, not /services/x).
  const part = pathname.startsWith(base)
    ? (pathname.slice(base.length).match(/^\/[^/]+/)?.[0] ?? "")
    : ""
  const category = businesses.find((item) => item.id === current.id)?.category
  const close = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={current.name}
                aria-label={t("switch")}
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <StoreIcon className="size-4" />
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{current.name}</span>
              {category && (
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {category}
                </span>
              )}
            </span>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
            className="min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
              {businesses.map((business) => (
                <DropdownMenuItem
                  key={business.id}
                  render={
                    <Link
                      href={`/dashboard/${business.id}${part}` as Route}
                      onClick={close}
                    />
                  }
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border">
                    <StoreIcon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {business.name}
                  </span>
                  {business.id === current.id && <CheckIcon />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/dashboard/new" onClick={close} />}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border">
                <PlusIcon className="size-4" />
              </span>
              <span className="font-medium text-muted-foreground">
                {t("add")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
