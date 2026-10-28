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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useOwnerMessages } from "../i18n/provider"

// The owner area's menu, in groups, like Koblip Sales': on a computer it
// folds to icons (the top bar's ☰ or the rail); on a phone it slides in from
// the left. New pages go in a group here.
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
}: {
  business: { id: string; name: string }
}) {
  const pathname = usePathname()
  const m = useOwnerMessages().shell
  const { isMobile, setOpenMobile } = useSidebar()
  const base = `/dashboard/${business.id}`
  // On a phone the menu closes once a page is picked.
  const close = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={business.name}
              render={<Link href={base} onClick={close} />}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <StoreIcon className="size-4" />
              </span>
              <span className="truncate font-semibold">{business.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group.key}>
            <SidebarGroupLabel>{m.groups[group.key]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const href = base + item.path
                  const label = m.nav[item.key]
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        tooltip={label}
                        isActive={
                          item.path
                            ? pathname.startsWith(href)
                            : pathname === base
                        }
                        render={<Link href={href} onClick={close} />}
                      >
                        <item.icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
