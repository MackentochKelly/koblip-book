"use client"

import { type AccountMenuLink, type Owner } from "@/components/account-menu"
import { AppInset } from "@/components/app-inset"
import { AppTopBar } from "@/components/app-top-bar"
import { BottomTabBar, TabBarLink } from "@/components/bottom-tab-bar"
import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { PageContent } from "@/components/page-content"
import { TopBarAccount } from "@/components/top-bar-account"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// The tab bar's columns, one per page (it holds two to five).
const TAB_COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
} as const

// An app area's frame, the same for every area (team, client): the menu
// beside the page on a computer (folding to icons), a tab bar on a phone,
// and the top bar with the open page's name. With `account`, the menu ends
// with who is logged in, opening the account menu (appearance, language,
// log out), and the top bar ends with them too, after the area's `bell`,
// so a phone (no menu in view) has them. The area passes only its pages.
export function AppShell({
  title,
  items,
  menuLabel,
  account,
  settingsHref,
  accountLinks,
  bell,
  children,
}: {
  // The menu's title, and the tab bar's name for screen readers.
  title: string
  items: NavItem[]
  menuLabel: string
  account?: Owner
  settingsHref?: string
  // More pages in the account menu, beside Settings.
  accountLinks?: AccountMenuLink[]
  // The area's notifications, at the top bar's end.
  bell?: React.ReactNode
  children: React.ReactNode
}) {
  const open = items.find((item) => item.active)
  const columns =
    TAB_COLUMNS[
      Math.min(Math.max(items.length, 2), 5) as keyof typeof TAB_COLUMNS
    ]
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent className="scroll-fade">
            <NavMain title={title} items={items} />
          </SidebarContent>
          {account && (
            <SidebarFooter>
              <NavUser
                owner={account}
                settingsHref={settingsHref}
                links={accountLinks}
              />
            </SidebarFooter>
          )}
          <SidebarRail />
        </Sidebar>
        <AppInset>
          <AppTopBar title={open?.label ?? title} menuLabel={menuLabel}>
            {account && (
              <TopBarAccount
                owner={account}
                settingsHref={settingsHref}
                links={accountLinks}
              >
                {bell}
              </TopBarAccount>
            )}
          </AppTopBar>
          <PageContent className="pb-28">{children}</PageContent>
        </AppInset>
        <BottomTabBar label={title} className={cn(columns)}>
          {items.slice(0, 5).map((item) => (
            <TabBarLink key={item.href} {...item} />
          ))}
        </BottomTabBar>
      </SidebarProvider>
    </TooltipProvider>
  )
}
