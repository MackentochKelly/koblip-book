"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  BanknoteIcon,
  BellIcon,
  CalendarDaysIcon,
  ContactIcon,
  CreditCardIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  SparklesIcon,
  StarIcon,
  WhatsAppIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/icons"

import { AppInset } from "@/components/app-inset"
import { AppTopBar } from "@/components/app-top-bar"
import { NavMain } from "@/components/nav-main"
import { PageContent } from "@/components/page-content"
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

const BASE = "/admin"

const NAV = [
  { path: "", key: "overview", icon: LayoutDashboardIcon },
  { path: "/businesses", key: "businesses", icon: StoreIcon },
  { path: "/owners", key: "owners", icon: ContactIcon },
  { path: "/team", key: "team", icon: UsersIcon },
  { path: "/service-categories", key: "serviceCategories", icon: TagIcon },
  { path: "/bookings", key: "bookings", icon: CalendarDaysIcon },
  { path: "/reviews", key: "reviews", icon: StarIcon },
  { path: "/whatsapp", key: "whatsapp", icon: WhatsAppIcon },
  { path: "/notifications", key: "notifications", icon: BellIcon },
  { path: "/translations", key: "translations", icon: LanguagesIcon },
  { path: "/assistant", key: "assistant", icon: SparklesIcon },
  { path: "/plans", key: "plans", icon: CreditCardIcon },
  { path: "/subscriptions", key: "subscriptions", icon: BanknoteIcon },
] as const

// The admin area, built like the owner dashboard: the same menu (folding on
// a computer, sliding in from ☰ on a phone) and the same top bar.
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations("admin")
  const items = NAV.map((item) => ({
    href: BASE + item.path,
    label: t(`nav.${item.key}`),
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
            <NavMain title={t("groups.app")} items={items} />
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
        <AppInset>
          <AppTopBar title={t("admin")} menuLabel={t("admin")} />
          <PageContent>{children}</PageContent>
        </AppInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
