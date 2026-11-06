"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { SearchIcon } from "@/components/ui/icons"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { NAV_GROUPS, NOT_IN_MENU, navFeature } from "../navigation"
import type { LockedPlans } from "../types"
import type { OwnedBusiness } from "../types"
import type { Owner } from "./account-menu"
import { BusinessSwitcher } from "./business-switcher"
import { useCommandMenu } from "./command-menu"
import { NAV_ICON_SIZE, NavMain } from "@/components/nav-main"
import { NavUser } from "./nav-user"

// The owner area's menu, built like Koblip Sales' AppSidebar (shadcn
// sidebar-07): the business switcher and Search on top, the pages in
// groups, the account at the foot.
// On a computer it folds to icons (the top bar's ☰ or the rail); on a phone
// it is the drawer from the left.
export function AppSidebar({
  business,
  businesses,
  owner,
  lockedPlans,
}: {
  business: { id: string; name: string }
  businesses: OwnedBusiness[]
  owner: Owner
  // The features this business's plan lacks, each with the plan that has it.
  lockedPlans: LockedPlans
}) {
  const pathname = usePathname()
  const t = useTranslations("owner.shell")
  const plans = useTranslations("app.planLocked.plans")
  const { isMobile, setOpenMobile } = useSidebar()
  const openCommandMenu = useCommandMenu()
  const base = `/dashboard/${business.id}`
  const openSearch = () => {
    if (isMobile) setOpenMobile(false)
    openCommandMenu(true)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BusinessSwitcher current={business} businesses={businesses} />
        {/* A search field when open; just the icon when folded. */}
        <InputGroup className="group-data-[collapsible=icon]:hidden">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            readOnly
            placeholder={t("search")}
            aria-label={t("searchHint")}
            aria-haspopup="dialog"
            className="cursor-pointer"
            onClick={openSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                openSearch()
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <Kbd>⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton
              variant="outline"
              className={NAV_ICON_SIZE}
              tooltip={t("search")}
              onClick={openSearch}
            >
              <SearchIcon />
              <span>{t("search")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="scroll-fade">
        {NAV_GROUPS.map((group) => (
          <NavMain
            key={group.key}
            title={group.key === "main" ? undefined : t(`groups.${group.key}`)}
            items={group.items
              .filter((item) => !NOT_IN_MENU.includes(item.key))
              .map((item) => {
                const href = base + item.path
                const feature = navFeature(item)
                const needs = feature ? lockedPlans[feature] : undefined
                return {
                  badge: needs ? plans(needs) : undefined,
                  href,
                  // Home is Dashboard on a computer; the phone's menu keeps
                  // Home, like its tab.
                  label:
                    item.key === "home" && !isMobile
                      ? t("nav.dashboard")
                      : t(`nav.${item.key}`),
                  icon: item.icon,
                  active: item.path
                    ? pathname.startsWith(href)
                    : pathname === base,
                }
              })}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser owner={owner} settingsHref={`${base}/settings`} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
