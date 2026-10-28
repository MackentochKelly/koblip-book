"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClockIcon,
  ContactIcon,
  LayoutDashboardIcon,
  ScissorsIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AppSidebar } from "./app-sidebar"
import { CommandMenuProvider } from "./command-menu"
import { TopBar } from "./top-bar"

const NAV = [
  { path: "", label: "Home", icon: LayoutDashboardIcon },
  { path: "/customers", label: "Customers", icon: ContactIcon },
  { path: "/services", label: "Services", icon: ScissorsIcon },
  { path: "/team", label: "Team", icon: UsersIcon },
  { path: "/hours", label: "Hours", icon: ClockIcon },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
]

// The owner area: the ☰ menu (folding on a computer, sliding in on a phone),
// a bottom tab bar on a phone for the main pages, and a top bar with the
// business name, its public page and the account menu.
export function DashboardShell({
  business,
  owner,
  children,
}: {
  business: { id: string; slug: string; name: string }
  owner: { name: string; email: string; image: string | null }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const base = `/dashboard/${business.id}`
  const items = NAV.map((item) => ({
    ...item,
    href: base + item.path,
    active: item.path
      ? pathname.startsWith(base + item.path)
      : pathname === base,
  }))
  return (
    <TooltipProvider>
      <CommandMenuProvider business={business}>
        <SidebarProvider>
        <AppSidebar businessId={business.id} owner={owner} />
        <SidebarInset className="min-w-0">
          <TopBar business={business} owner={owner} menu />
          <div className="mx-auto w-full max-w-3xl p-4 pb-28 md:p-8">
            {children}
          </div>
        </SidebarInset>
        <nav
          aria-label="Owner"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                item.active && "text-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        </SidebarProvider>
      </CommandMenuProvider>
    </TooltipProvider>
  )
}
