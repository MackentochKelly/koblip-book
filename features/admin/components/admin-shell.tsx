"use client"

import { usePathname } from "next/navigation"
import {
  BellIcon,
  CalendarDaysIcon,
  ContactIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  StoreIcon,
} from "@/components/ui/icons"

import { AppTopBar } from "@/components/app-top-bar"
import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAdminMessages } from "../i18n/provider"

const BASE = "/admin"

const NAV = [
  { path: "", key: "overview", icon: LayoutDashboardIcon },
  { path: "/businesses", key: "businesses", icon: StoreIcon },
  { path: "/owners", key: "owners", icon: ContactIcon },
  { path: "/bookings", key: "bookings", icon: CalendarDaysIcon },
  { path: "/whatsapp", key: "whatsapp", icon: MessageCircleIcon },
  { path: "/notifications", key: "notifications", icon: BellIcon },
] as const

// The admin area, built like the owner dashboard: the same menu (folding on
// a computer, sliding in from ☰ on a phone) and the same top bar.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const m = useAdminMessages()
  const items = NAV.map((item) => ({
    href: BASE + item.path,
    label: m.nav[item.key],
    icon: item.icon,
    active: item.path
      ? pathname.startsWith(BASE + item.path)
      : pathname === BASE,
  }))
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent className="scroll-fade">
            <NavMain title={m.groups.app} items={items} />
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-w-0">
          <AppTopBar title={m.admin} menuLabel={m.admin} />
          <div className="mx-auto w-full max-w-page p-4 md:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
