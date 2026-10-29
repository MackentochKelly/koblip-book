"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClockIcon,
  ContactIcon,
  filledIcon,
  LayoutDashboardIcon,
  TagIcon,
  SparklesIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useOwnerMessages } from "@/features/dashboard/i18n/provider"
import { cn } from "@/lib/utils"
import { AppSidebar } from "./app-sidebar"
import { CommandMenuProvider } from "./command-menu"
import { TopBar } from "./top-bar"

const NAV = [
  { path: "", key: "home", icon: LayoutDashboardIcon },
  { path: "/customers", key: "customers", icon: ContactIcon },
  { path: "/services", key: "services", icon: TagIcon },
  { path: "/team", key: "team", icon: UsersIcon },
  { path: "/hours", key: "hours", icon: ClockIcon },
  { path: "/settings", key: "settings", icon: SettingsIcon },
] as const

// Form pages stay a narrow column on a computer, like big apps' settings;
// lists and the home page use the wider frame.
const FORM_PAGES = ["/hours", "/settings"]

// The phone has room for four tabs with the assistant between them; Hours
// and Settings open from the ☰ menu (Settings also from the account menu).
const PHONE_LEFT = ["", "/customers"]
const PHONE_RIGHT = ["/services", "/team"]

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
  const m = useOwnerMessages().shell.nav
  const base = `/dashboard/${business.id}`
  const assistantHref = `${base}/assistant`
  const assistantOpen = pathname.startsWith(assistantHref)
  const formPage = FORM_PAGES.some((path) => pathname.startsWith(base + path))
  const items = NAV.map((item) => ({
    ...item,
    label: m[item.key],
    href: base + item.path,
    active: item.path
      ? pathname.startsWith(base + item.path)
      : pathname === base,
  }))
  const tab = (path: string) => {
    const item = items.find((found) => found.path === path)
    if (!item) return null
    const active = item.active
    const TabIcon = active ? filledIcon(item.icon) : item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
          active && "text-foreground"
        )}
      >
        {/* As in Koblip Sales' BottomTabBar: the open tab's icon is filled. */}
        <TabIcon className="size-5" />
        <span className="max-w-full truncate">{item.label}</span>
      </Link>
    )
  }
  // On a phone the assistant is a full page of its own, with its own back
  // button: no top bar or tab bar. On a computer it fills the page beside
  // the menu, under the top bar.
  return (
    <TooltipProvider>
      <CommandMenuProvider business={business}>
        <SidebarProvider>
          <AppSidebar businessId={business.id} owner={owner} />
          <SidebarInset className={cn("min-w-0", assistantOpen && "md:h-dvh")}>
            <TopBar
              business={business}
              owner={owner}
              menu
              className={cn(assistantOpen && "max-md:hidden")}
            />
            <div
              className={cn(
                "mx-auto w-full max-w-3xl p-4 pb-28 md:p-8",
                !formPage && !assistantOpen && "lg:max-w-page",
                assistantOpen &&
                  "flex min-h-0 max-w-none flex-1 flex-col p-0 pb-0 md:p-0"
              )}
            >
              {children}
            </div>
          </SidebarInset>
          <nav
            aria-label={m.owner}
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden",
              assistantOpen && "hidden"
            )}
          >
            {PHONE_LEFT.map((path) => tab(path))}
            <div className="flex min-h-14 items-center justify-center">
              <Button
                size="icon-lg"
                // A soft 2 px ring drawn over its own colour, and a 24 px icon.
                className="size-11 border-2 border-primary-foreground/45 bg-clip-border"
                aria-label={m.assistant}
                nativeButton={false}
                render={<Link href={assistantHref} />}
              >
                <SparklesIcon className="size-6" />
              </Button>
            </div>
            {PHONE_RIGHT.map((path) => tab(path))}
          </nav>
        </SidebarProvider>
      </CommandMenuProvider>
    </TooltipProvider>
  )
}
