"use client"

import { usePathname } from "next/navigation"
import { SearchIcon } from "lucide-react"

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
import { useOwnerMessages } from "../i18n/provider"
import { NAV_GROUPS } from "../navigation"
import type { Owner } from "./account-menu"
import { useCommandMenu } from "./command-menu"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"

// The owner area's menu, built like Koblip Sales' AppSidebar (shadcn
// sidebar-07): Search on top, the pages in groups, the account at the foot.
// On a computer it folds to icons (the top bar's ☰ or the rail); on a phone
// it is the drawer from the left.
export function AppSidebar({
  businessId,
  owner,
}: {
  businessId: string
  owner: Owner
}) {
  const pathname = usePathname()
  const m = useOwnerMessages().shell
  const { isMobile, setOpenMobile } = useSidebar()
  const openCommandMenu = useCommandMenu()
  const base = `/dashboard/${businessId}`
  const openSearch = () => {
    if (isMobile) setOpenMobile(false)
    openCommandMenu(true)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* A search field when open; just the icon when folded. */}
        <InputGroup className="bg-background group-data-[collapsible=icon]:hidden">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            readOnly
            placeholder={m.search}
            aria-label={m.searchHint}
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
              tooltip={m.search}
              onClick={openSearch}
            >
              <SearchIcon />
              <span>{m.search}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavMain
            key={group.key}
            title={m.groups[group.key]}
            items={group.items.map((item) => {
              const href = base + item.path
              return {
                href,
                label: m.nav[item.key],
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
        <NavUser owner={owner} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
