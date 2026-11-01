"use client"

import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
} from "@/components/ui/icons"

import { AppInset } from "@/components/app-inset"
import { AppTopBar } from "@/components/app-top-bar"
import { BottomTabBar, TabBarLink } from "@/components/bottom-tab-bar"
import { NavMain } from "@/components/nav-main"
import { PageContent } from "@/components/page-content"
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTeamAreaWords } from "../i18n/provider"

const NAV = [
  { path: "", key: "bookings", icon: CalendarDaysIcon },
  { path: "/hours", key: "hours", icon: ClockIcon },
  { path: "/profile", key: "profile", icon: UserIcon },
] as const

// A team member's own area (docs/plans/team-accounts.md), built like the
// owner dashboard: the menu beside the page on a computer, a tab bar on a
// phone, and the top bar with the business's name.
export function TeamShell({
  teamMemberId,
  businessName,
  children,
}: {
  teamMemberId: string
  businessName: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const t = useTeamAreaWords()
  const base = `/team/${teamMemberId}`
  const items = NAV.map((item) => ({
    href: base + item.path,
    label: t.nav[item.key],
    icon: item.icon,
    active: item.path ? pathname.startsWith(base + item.path) : pathname === base,
  }))
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent className="scroll-fade">
            <NavMain title={businessName} items={items} />
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
        <AppInset>
          <AppTopBar
            title={items.find((item) => item.active)?.label ?? businessName}
            menuLabel={t.menu}
          />
          <PageContent className="pb-28">{children}</PageContent>
        </AppInset>
        <BottomTabBar label={businessName} className="grid-cols-3">
          {items.map((item) => (
            <TabBarLink key={item.href} {...item} />
          ))}
        </BottomTabBar>
      </SidebarProvider>
    </TooltipProvider>
  )
}
