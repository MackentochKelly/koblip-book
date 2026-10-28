"use client"

import { ChevronsUpDownIcon } from "@/components/ui/icons"

import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { AccountMenuContent, OwnerAvatar, type Owner } from "./account-menu"

// The menu's footer, as in Koblip Sales' NavUser: who is logged in, opening
// the same account menu as the top bar's photo.
export function NavUser({
  owner,
  settingsHref,
}: {
  owner: Owner
  settingsHref: string
}) {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={owner.name}
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <OwnerAvatar owner={owner} className="size-8 rounded-lg" />
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{owner.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {owner.email}
              </span>
            </span>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <AccountMenuContent
            owner={owner}
            settingsHref={settingsHref}
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={16}
          />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
