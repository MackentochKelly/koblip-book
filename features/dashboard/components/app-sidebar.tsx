"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  ClockIcon,
  ContactIcon,
  MessageCircleIcon,
  ScissorsIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react"

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
import type { Owner } from "./account-menu"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"

// The owner area's menu, built like Koblip Sales' AppSidebar (shadcn
// sidebar-07): the business on top, the pages in groups, the account at the
// foot. On a computer it folds to icons (the top bar's ☰ or the rail); on a
// phone it slides in from the left. New pages go in a group here.
const GROUPS = [
  {
    key: "business",
    items: [
      { path: "", key: "bookings", icon: CalendarDaysIcon },
      { path: "/customers", key: "customers", icon: ContactIcon },
      { path: "/services", key: "services", icon: ScissorsIcon },
      { path: "/assistant", key: "assistant", icon: MessageCircleIcon },
    ],
  },
  {
    key: "settings",
    items: [
      { path: "/team", key: "team", icon: UsersIcon },
      { path: "/hours", key: "hours", icon: ClockIcon },
      { path: "/settings", key: "details", icon: StoreIcon },
    ],
  },
] as const

export function AppSidebar({
  business,
  owner,
}: {
  business: { id: string; name: string }
  owner: Owner
}) {
  const pathname = usePathname()
  const m = useOwnerMessages().shell
  const { isMobile, setOpenMobile } = useSidebar()
  const base = `/dashboard/${business.id}`

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={business.name}
              render={
                <Link
                  href={base}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false)
                  }}
                />
              }
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <StoreIcon className="size-4" />
              </span>
              <span className="truncate font-medium">{business.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((group) => (
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
