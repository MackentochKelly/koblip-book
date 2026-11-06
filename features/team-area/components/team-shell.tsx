"use client"

import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
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
import { PhotoWordsProvider, type PhotoWords } from "@/components/photo-upload"
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

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
  const t = useTranslations("teamArea")
  const photos = useTranslations("teamArea.photos")
  // The photo buttons' words, one object while the words stay the same, so
  // the photo fields don't redraw on every page change.
  const photoWords = useMemo<PhotoWords>(
    () => ({
      change: photos("change"),
      addPhoto: photos("addPhoto"),
      remove: photos("remove"),
      errors: {
        not_found: photos("errors.not_found"),
        missing: photos("errors.missing"),
        too_big: photos("errors.too_big"),
        wrong_type: photos("errors.wrong_type"),
        limit: photos("errors.limit"),
      },
    }),
    [photos]
  )
  const base = `/team/${teamMemberId}`
  const items = NAV.map((item) => ({
    href: base + item.path,
    label: t(`nav.${item.key}`),
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
            menuLabel={t("menu")}
          />
          <PageContent className="pb-28">
            <PhotoWordsProvider words={photoWords}>{children}</PhotoWordsProvider>
          </PageContent>
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
